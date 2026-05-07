import { sendPasswordResetOtpEmail } from "@/app/lib/email";
import { createOtpCode, hashOtp, passwordResetOtpPurpose } from "@/app/lib/otp";
import { fail, ok, serverError } from "@/app/lib/api-response";
import { prisma } from "@/app/lib/prisma";
import { clientIp, rateLimit } from "@/app/lib/security";
import { passwordResetOtpSchema } from "@/app/lib/validators";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(`password-reset-otp:${clientIp(req)}`, { limit: 8, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 });
    if (!limited.allowed) return fail(`Gui OTP qua nhieu lan. Thu lai sau ${limited.retryAfter} giay.`, 429);

    const parsed = passwordResetOtpSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Du lieu khong hop le.", 422);

    const email = parsed.data.email;
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, status: true } });
    if (!user || user.status !== "ACTIVE") {
      return ok({ sent: true });
    }

    const code = createOtpCode();
    const otp = await prisma.emailOtp.create({
      data: {
        email,
        purpose: passwordResetOtpPurpose,
        codeHash: hashOtp(email, passwordResetOtpPurpose, code),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const sent = await sendPasswordResetOtpEmail(email, code);
    if (!sent.ok) {
      await prisma.emailOtp.delete({ where: { id: otp.id } }).catch(() => null);
      return fail(sent.reason === "SMTP_CONFIG_MISSING" ? "Chua cau hinh SMTP de gui OTP." : "Chua gui duoc OTP. Thu lai sau.", 503);
    }

    return ok({ sent: true });
  } catch (error) {
    return serverError(error);
  }
}
