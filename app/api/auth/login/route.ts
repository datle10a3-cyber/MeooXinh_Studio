import { fail, ok, serverError } from "@/app/lib/api-response";
import {
  createRefreshTokenValue,
  ensureRootAdminAccount,
  isRootAdminLogin,
  persistRefreshToken,
  sessionDeviceFromRequest,
  setAuthCookies,
  signAccessToken,
  type SessionUser,
  verifyPassword,
} from "@/app/lib/auth";
import { writeAuditLog } from "@/app/lib/audit";
import { assertProductionSafe } from "@/app/lib/deploy-safety";
import { prisma } from "@/app/lib/prisma";
import { clientIp, rateLimit } from "@/app/lib/security";
import { loginSchema } from "@/app/lib/validators";

export async function POST(req: Request) {
  try {
    assertProductionSafe();
    const parsed = loginSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Dữ liệu đăng nhập không hợp lệ.", 422, parsed.error.flatten());
    const ip = clientIp(req);
    const ipLimit = rateLimit(`login-ip:${ip}`, { limit: 30, windowMs: 15 * 60 * 1000, blockMs: 30 * 60 * 1000 });
    const emailLimit = rateLimit(`login-email:${parsed.data.email}`, { limit: 8, windowMs: 15 * 60 * 1000, blockMs: 30 * 60 * 1000 });
    if (!ipLimit.allowed || !emailLimit.allowed) {
      const retryAfter = Math.max(ipLimit.retryAfter, emailLimit.retryAfter);
      return fail(`Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(retryAfter / 60)} phút.`, 429);
    }

    if (isRootAdminLogin(parsed.data.email, parsed.data.password)) {
      await ensureRootAdminAccount();
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      include: { role: true, studio: true },
    });
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return fail("Email hoặc mật khẩu không đúng.", 401);
    }
    if (user.status === "DISABLED") return fail("Tài khoản này đang bị khóa tạm thời.", 403);
    if (user.status === "DELETED") return fail("Tài khoản này đã bị xóa khỏi danh sách admin.", 403);
    if (user.status !== "ACTIVE") return fail("Tài khoản chưa được kích hoạt.", 403);

    const sessionUser: SessionUser = {
      id: user.id,
      studioId: user.studioId,
      role: (user.role?.name ?? "STAFF") as SessionUser["role"],
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
    };
    const refreshToken = createRefreshTokenValue();
    await persistRefreshToken(user.id, refreshToken, sessionDeviceFromRequest(req));
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await setAuthCookies(await signAccessToken(sessionUser), refreshToken);
    await writeAuditLog(sessionUser, "LOGIN", "Auth", user.id, { name: user.name, ipAddress: ip });

    return ok({ user: sessionUser, studio: user.studio });
  } catch (error) {
    return serverError(error);
  }
}
