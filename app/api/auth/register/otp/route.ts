import { fail, ok, serverError } from "@/app/lib/api-response";
import { assertProductionSafe } from "@/app/lib/deploy-safety";
import { sendRegistrationOtpEmail } from "@/app/lib/email";
import { createOtpCode, hashOtp, registrationOtpPurpose } from "@/app/lib/otp";
import { prisma } from "@/app/lib/prisma";
import { clientIp, rateLimit } from "@/app/lib/security";
import { registerOtpSchema } from "@/app/lib/validators";

export async function POST(req: Request) {
  try {
    assertProductionSafe();
    if (process.env.ALLOW_STUDIO_REGISTRATION !== "true") {
      return fail("Dang ky studio moi dang bi khoa.", 403);
    }

    const parsed = registerOtpSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Email khong hop le.", 422, parsed.error.flatten());

    const { email } = parsed.data;
    const ipLimit = rateLimit(`register-otp-ip:${clientIp(req)}`, { limit: 10, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 });
    const emailLimit = rateLimit(`register-otp-email:${email}`, { limit: 4, windowMs: 15 * 60 * 1000, blockMs: 30 * 60 * 1000 });
    if (!ipLimit.allowed || !emailLimit.allowed) {
      const retryAfter = Math.max(ipLimit.retryAfter, emailLimit.retryAfter);
      return fail(`Gui OTP qua nhieu lan. Vui long thu lai sau ${Math.ceil(retryAfter / 60)} phut.`, 429);
    }

    const existed = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existed) return fail("Email nay da duoc su dung. Moi email chi duoc tao 1 tai khoan.", 409);

    const code = createOtpCode();
    const otp = await prisma.emailOtp.create({
      data: {
        email,
        purpose: registrationOtpPurpose,
        codeHash: hashOtp(email, registrationOtpPurpose, code),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    const sent = await sendRegistrationOtpEmail(email, code);
    if (!sent.ok) {
      await prisma.emailOtp.delete({ where: { id: otp.id } }).catch(() => null);
      if (sent.reason === "SMTP_CONFIG_MISSING") {
        return fail("Chua cau hinh SMTP nen khong gui duoc OTP. Hay them SMTP_HOST, SMTP_USER, SMTP_PASS vao .env/Vercel env.", 503);
      }
      return fail("Khong gui duoc OTP den email nay. Vui long kiem tra cau hinh SMTP hoac thu lai sau.", 502);
    }

    return ok({ message: "Da gui OTP den email. Ma co hieu luc trong 10 phut." });
  } catch (error) {
    return serverError(error);
  }
}
