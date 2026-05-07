const weakInviteCodes = new Set(["MEOXINH08012006", "doi-ma-moi-rieng-khi-can-mo-dang-ky"]);

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function hasLocalDatabaseUrl() {
  const value = process.env.DATABASE_URL ?? "";
  return /localhost|127\.0\.0\.1|192\.168\.|host\.docker\.internal/i.test(value);
}

export function productionSafetyIssues() {
  if (!isProduction()) return [];

  const issues: string[] = [];
  const jwtSecret = process.env.JWT_SECRET ?? "";
  const inviteCode = process.env.STUDIO_REGISTRATION_CODE?.trim() ?? "";

  if (!process.env.DATABASE_URL) issues.push("Thiếu DATABASE_URL.");
  if (hasLocalDatabaseUrl()) issues.push("DATABASE_URL đang trỏ về máy local.");
  if (jwtSecret.length < 48 || jwtSecret.includes("doi-") || jwtSecret.includes("tao-chuoi")) {
    issues.push("JWT_SECRET chưa đủ mạnh.");
  }
  if (process.env.AUTH_DEV_BYPASS === "true" || process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS === "true") {
    issues.push("Dev bypass đang bật.");
  }
  if (process.env.ALLOW_STUDIO_REGISTRATION === "true") {
    if (inviteCode.length < 14 || weakInviteCodes.has(inviteCode)) {
      issues.push("Mã mời đăng ký studio chưa đủ an toàn.");
    }
  }
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    issues.push("Chưa cấu hình Cloudinary để lưu ảnh bền vững.");
  }
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    issues.push("Chưa cấu hình VAPID cho thông báo đẩy.");
  }

  return issues;
}

export function assertProductionSafe() {
  const issues = productionSafetyIssues();
  if (issues.length) {
    throw new Error(`PRODUCTION_CONFIG_UNSAFE: ${issues.join(" ")}`);
  }
}

export function assertSafeMediaStorage() {
  if (!isProduction()) return;
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("MEDIA_STORAGE_NOT_CONFIGURED");
  }
}
