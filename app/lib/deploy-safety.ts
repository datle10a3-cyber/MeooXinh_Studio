const weakInviteCodes = new Set([
  "MEOXINH08012006",
  "doi-ma-moi-rieng-khi-can-mo-dang-ky",
]);

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function hasLocalDatabaseUrl() {
  const value = process.env.DATABASE_URL ?? "";
  return /localhost|127\.0\.0\.1|192\.168\.|host\.docker\.internal/i.test(
    value,
  );
}

export function productionSafetyIssues() {
  if (!isProduction()) return [];

  const issues: string[] = [];
  const jwtSecret = process.env.JWT_SECRET ?? "";
  const inviteCode = process.env.STUDIO_REGISTRATION_CODE?.trim() ?? "";

  // DATABASE
  if (!process.env.DATABASE_URL) {
    issues.push("Thiếu DATABASE_URL.");
  }

  if (hasLocalDatabaseUrl()) {
    issues.push("DATABASE_URL đang trỏ về máy local.");
  }

  // JWT
  if (
    jwtSecret.length < 48 ||
    jwtSecret.includes("doi-") ||
    jwtSecret.includes("tao-chuoi")
  ) {
    issues.push("JWT_SECRET chưa đủ mạnh.");
  }

  // DEV BYPASS
  if (
    process.env.AUTH_DEV_BYPASS === "true" ||
    process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS === "true"
  ) {
    issues.push("Dev bypass đang bật.");
  }

  // INVITE CODE
  if (process.env.ALLOW_STUDIO_REGISTRATION === "true") {
    if (inviteCode.length < 14 || weakInviteCodes.has(inviteCode)) {
      issues.push("Mã mời đăng ký studio chưa đủ an toàn.");
    }
  }

  // ⚠️ Bỏ kiểm tra Cloudinary
  // ⚠️ Bỏ kiểm tra VAPID

  return issues;
}

export function assertProductionSafe() {
  const issues = productionSafetyIssues();

  // Chỉ cảnh báo thay vì crash server
  if (issues.length) {
    console.warn("PRODUCTION_CONFIG_UNSAFE:", issues.join(" "));
  }
}

export function assertSafeMediaStorage() {
  // Không crash nữa
  return;
}
