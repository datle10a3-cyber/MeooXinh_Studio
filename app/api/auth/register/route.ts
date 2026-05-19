import { created, fail, serverError } from "@/app/lib/api-response";
import {
  createRefreshTokenValue,
  hashPassword,
  persistRefreshToken,
  sessionDeviceFromRequest,
  setAuthCookies,
  signAccessToken,
} from "@/app/lib/auth";
import { assertProductionSafe } from "@/app/lib/deploy-safety";
import { registrationOtpPurpose, verifyAndConsumeOtp } from "@/app/lib/otp";
import { prisma } from "@/app/lib/prisma";
import { clientIp, rateLimit, strongPasswordMessage } from "@/app/lib/security";
import { registrationInviteCode } from "@/app/lib/system-settings";
import { registerSchema } from "@/app/lib/validators";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

function isReservedSuperAdminName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase() === "super admin";
}

export async function POST(req: Request) {
  try {
    assertProductionSafe();

    const limited = rateLimit(`register:${clientIp(req)}`, { limit: 5, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 });
    if (!limited.allowed) return fail(`Bạn thử tạo studio quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(limited.retryAfter / 60)} phút.`, 429);

    const parsed = registerSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Dữ liệu đăng ký không hợp lệ.", 422, parsed.error.flatten());

    const { studioName, name, email, password, otp, inviteCode } = parsed.data;
    const passwordError = strongPasswordMessage(password);
    if (passwordError) return fail(passwordError, 422);
    if (isReservedSuperAdminName(name) || isReservedSuperAdminName(studioName)) {
      return fail("Tên Super Admin chỉ dành cho tài khoản quản trị chính.", 422);
    }

    const existed = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existed) return fail("Email này đã được sử dụng hoặc đã bị xóa khỏi admin. Không thể đăng ký lại email này.", 409);

    const inviteOk = String(inviteCode ?? "").trim() === await registrationInviteCode();
    if (!inviteOk) return fail("Mã mời không đúng. Không thể tạo studio mới.", 403);

    if (otp) {
      const verifiedOtp = await verifyAndConsumeOtp(email, registrationOtpPurpose, otp);
      if (!verifiedOtp.ok) return fail(verifiedOtp.message ?? "Mã OTP không hợp lệ.", 401);
    }

    const slugBase = slugify(studioName) || "studio";
    const studioSlug = `${slugBase}-${Date.now().toString(36)}`;
    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (duplicate) throw new Error("EMAIL_ALREADY_EXISTS");

      const studio = await tx.studio.create({
        data: { name: studioName, slug: studioSlug, phone: "0334043870" },
      });
      const role = await tx.role.create({
        data: {
          studioId: studio.id,
          name: "ADMIN",
          description: "Toàn quyền quản trị studio.",
        },
      });
      const user = await tx.user.create({
        data: {
          studioId: studio.id,
          roleId: role.id,
          name,
          email,
          passwordHash,
        },
      });
      await tx.wallet.create({
        data: {
          studioId: studio.id,
          name: "Tiền mặt",
          type: "CASH",
        },
      });
      return { studio, role, user };
    });

    const sessionUser = {
      id: result.user.id,
      studioId: result.studio.id,
      role: result.role.name as "ADMIN",
      name: result.user.name,
      email: result.user.email,
    };
    const refreshToken = createRefreshTokenValue();
    await persistRefreshToken(result.user.id, refreshToken, sessionDeviceFromRequest(req));
    await setAuthCookies(await signAccessToken(sessionUser), refreshToken);

    return created({ user: sessionUser, studio: result.studio });
  } catch (error) {
    if ((error as Error).message === "EMAIL_ALREADY_EXISTS") {
      return fail("Email này đã được sử dụng hoặc đã bị xóa khỏi admin. Không thể đăng ký lại email này.", 409);
    }
    return serverError(error);
  }
}
