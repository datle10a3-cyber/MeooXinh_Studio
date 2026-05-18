import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";

const inviteCodeKey = "registration_invite_code";
const shiftPasswordHashKey = "default_shift_password_hash";
const fallbackInviteCode = "MEOXINH08012006";
const fallbackShiftPassword = "000000";

function missingSystemSettingsTable(error: unknown) {
  const message = String((error as { message?: unknown })?.message ?? "");
  const code = String((error as { code?: unknown })?.code ?? "");
  return code === "P2021" || message.includes("SystemSetting") || message.includes("systemSetting");
}

async function readSetting(key: string) {
  try {
    return await prisma.systemSetting.findUnique({ where: { key } });
  } catch (error) {
    if (missingSystemSettingsTable(error)) {
      await ensureSystemSettingsTable();
      return prisma.systemSetting.findUnique({ where: { key } });
    }
    throw error;
  }
}

async function writeSetting(key: string, value: string) {
  try {
    return await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  } catch (error) {
    if (missingSystemSettingsTable(error)) {
      await ensureSystemSettingsTable();
      return prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }
    throw error;
  }
}

async function ensureSystemSettingsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SystemSetting" (
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
    )
  `);
}

export async function registrationInviteCode() {
  const row = await readSetting(inviteCodeKey);
  return row?.value || process.env.STUDIO_REGISTRATION_CODE?.trim() || fallbackInviteCode;
}

export async function updateRegistrationInviteCode(value: string) {
  const inviteCode = value.trim();
  return writeSetting(inviteCodeKey, inviteCode);
}

export async function verifyDefaultShiftPassword(password: string) {
  const row = await readSetting(shiftPasswordHashKey);
  if (row?.value) return bcrypt.compare(password, row.value);
  return password === fallbackShiftPassword;
}

export async function updateDefaultShiftPassword(password: string) {
  const value = await bcrypt.hash(password, 12);
  return writeSetting(shiftPasswordHashKey, value);
}

export async function rootSystemSettingsSummary() {
  const inviteCode = await registrationInviteCode();
  let shiftPasswordRow: Awaited<ReturnType<typeof readSetting>> = null;
  const settingsStorageReady = true;
  try {
    shiftPasswordRow = await prisma.systemSetting.findUnique({ where: { key: shiftPasswordHashKey } });
  } catch (error) {
    if (!missingSystemSettingsTable(error)) throw error;
    await ensureSystemSettingsTable();
    shiftPasswordRow = await prisma.systemSetting.findUnique({ where: { key: shiftPasswordHashKey } });
  }
  return {
    inviteCode,
    inviteCodeLockedByEnv: false,
    hasCustomShiftPassword: Boolean(shiftPasswordRow?.value),
    settingsStorageReady,
  };
}
