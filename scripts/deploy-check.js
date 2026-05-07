/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

function loadDotEnv() {
  const filePath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const requiredProductionVars = [
  "DATABASE_URL",
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
];

const weakInviteCodes = new Set([
  "MEOXINH08012006",
  "doi-ma-moi-rieng-khi-can-mo-dang-ky",
]);

function env(name) {
  return String(process.env[name] || "").trim();
}

function hasLocalDatabaseUrl(value) {
  return /localhost|127\.0\.0\.1|192\.168\.|host\.docker\.internal/i.test(value);
}

function productionIssues() {
  const issues = [];

  for (const name of requiredProductionVars) {
    if (!env(name)) issues.push(`Missing ${name}.`);
  }

  const databaseUrl = env("DATABASE_URL");
  const jwtSecret = env("JWT_SECRET");
  const inviteCode = env("STUDIO_REGISTRATION_CODE");
  const smtpFrom = env("SMTP_FROM");

  if (databaseUrl && hasLocalDatabaseUrl(databaseUrl)) {
    issues.push("DATABASE_URL points to a local/private development host.");
  }

  if (jwtSecret.length < 48 || jwtSecret.includes("doi-") || jwtSecret.includes("tao-chuoi")) {
    issues.push("JWT_SECRET is missing, too short, or still looks like a placeholder.");
  }

  if (env("AUTH_DEV_BYPASS") === "true" || env("NEXT_PUBLIC_AUTH_DEV_BYPASS") === "true") {
    issues.push("Dev auth bypass is enabled.");
  }

  if (env("ALLOW_STUDIO_REGISTRATION") === "true") {
    if (inviteCode.length < 14 || weakInviteCodes.has(inviteCode)) {
      issues.push("Studio registration is open with a weak invite code.");
    }
  }

  if (smtpFrom && !smtpFrom.includes("@")) {
    issues.push("SMTP_FROM should contain a valid sender email address.");
  }

  return issues;
}

const nodeEnv = env("NODE_ENV") || "development";
if (nodeEnv !== "production") {
  console.log(`deploy-check skipped strict checks because NODE_ENV=${nodeEnv}.`);
  console.log("Run with NODE_ENV=production before deploying.");
  process.exit(0);
}

const issues = productionIssues();
if (issues.length) {
  console.error("Production deploy check failed:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Production deploy check passed.");
