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
    if (missingSystemSettingsTable(error)) return null;
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
      throw new Error("SYSTEM_SETTINGS_TABLE_MISSING");
    }
    throw error;
  }
}

export async function registrationInviteCode() {
  const configured = process.env.STUDIO_REGISTRATION_CODE?.trim();
  if (configured) return configured;
  const row = await readSetting(inviteCodeKey);
  return row?.value || fallbackInviteCode;
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
  let settingsStorageReady = true;
  try {
    shiftPasswordRow = await prisma.systemSetting.findUnique({ where: { key: shiftPasswordHashKey } });
  } catch (error) {
    if (!missingSystemSettingsTable(error)) throw error;
    settingsStorageReady = false;
  }
  return {
    inviteCode,
    inviteCodeLockedByEnv: Boolean(process.env.STUDIO_REGISTRATION_CODE?.trim()),
    hasCustomShiftPassword: Boolean(shiftPasswordRow?.value),
    settingsStorageReady,
  };
}
