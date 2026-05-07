import { fail, ok, serverError } from "@/app/lib/api-response";
import { hashPassword } from "@/app/lib/auth";
import { passwordResetOtpPurpose, verifyAndConsumeOtp } from "@/app/lib/otp";
import { prisma } from "@/app/lib/prisma";
import { clientIp, rateLimit, strongPasswordMessage } from "@/app/lib/security";
import { passwordResetSchema } from "@/app/lib/validators";

export async function PATCH(req: Request) {
  try {
    const limited = rateLimit(`password-reset:${clientIp(req)}`, { limit: 10, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 });
    if (!limited.allowed) return fail(`Dat lai mat khau qua nhieu lan. Thu lai sau ${limited.retryAfter} giay.`, 429);

    const parsed = passwordResetSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Du lieu khong hop le.", 422);

    const { email, otp, password, confirmPassword } = parsed.data;
    if (password !== confirmPassword) return fail("Mat khau xac nhan khong khop.", 422);
    const passwordError = strongPasswordMessage(password);
    if (passwordError) return fail(passwordError, 422);

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, status: true, passwordHash: true } });
    if (!user || user.status !== "ACTIVE") return fail("Khong tim thay tai khoan hoat dong voi email nay.", 404);

    const verified = await verifyAndConsumeOtp(email, passwordResetOtpPurpose, otp);
    if (!verified.ok) return fail(verified.message ?? "Ma OTP khong hop le.", 401);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password) },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return ok({ changed: true });
  } catch (error) {
    return serverError(error);
  }
}
