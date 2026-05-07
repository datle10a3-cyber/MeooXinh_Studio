import { createHash, randomInt } from "crypto";
import { prisma } from "@/app/lib/prisma";

export const registrationOtpPurpose = "STUDIO_REGISTRATION";

export function createOtpCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(email: string, purpose: string, code: string) {
  return createHash("sha256")
    .update(`${email.toLowerCase()}:${purpose}:${code}:${process.env.JWT_SECRET ?? ""}`)
    .digest("hex");
}

export async function verifyAndConsumeOtp(email: string, purpose: string, code: string) {
  const otp = await prisma.emailOtp.findFirst({
    where: {
      email,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return { ok: false, message: "Ma OTP da het han hoac khong ton tai." };
  if (otp.attempts >= 5) return { ok: false, message: "Ma OTP da bi khoa do nhap sai qua nhieu lan." };

  const codeHash = hashOtp(email, purpose, code);
  if (otp.codeHash !== codeHash) {
    await prisma.emailOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, message: "Ma OTP khong dung." };
  }

  await prisma.emailOtp.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true };
}
