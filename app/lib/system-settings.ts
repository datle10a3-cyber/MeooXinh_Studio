import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";

const inviteCodeKey = "registration_invite_code";
const shiftPasswordHashKey = "default_shift_password_hash";
const fallbackInviteCode = "MEOXINH08012006";
const fallbackShiftPassword = "000000";

export async function registrationInviteCode() {
  const configured = process.env.STUDIO_REGISTRATION_CODE?.trim();
  if (configured) return configured;
  const row = await prisma.systemSetting.findUnique({ where: { key: inviteCodeKey } });
  return row?.value || fallbackInviteCode;
}

export async function updateRegistrationInviteCode(value: string) {
  const inviteCode = value.trim();
  return prisma.systemSetting.upsert({
    where: { key: inviteCodeKey },
    update: { value: inviteCode },
    create: { key: inviteCodeKey, value: inviteCode },
  });
}

export async function verifyDefaultShiftPassword(password: string) {
  const row = await prisma.systemSetting.findUnique({ where: { key: shiftPasswordHashKey } });
  if (row?.value) return bcrypt.compare(password, row.value);
  return password === fallbackShiftPassword;
}

export async function updateDefaultShiftPassword(password: string) {
  const value = await bcrypt.hash(password, 12);
  return prisma.systemSetting.upsert({
    where: { key: shiftPasswordHashKey },
    update: { value },
    create: { key: shiftPasswordHashKey, value },
  });
}

export async function rootSystemSettingsSummary() {
  const [inviteCode, shiftPasswordRow] = await Promise.all([
    registrationInviteCode(),
    prisma.systemSetting.findUnique({ where: { key: shiftPasswordHashKey } }),
  ]);
  return {
    inviteCode,
    inviteCodeLockedByEnv: Boolean(process.env.STUDIO_REGISTRATION_CODE?.trim()),
    hasCustomShiftPassword: Boolean(shiftPasswordRow?.value),
  };
}
