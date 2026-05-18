import type { CurrentSession } from "@/app/types/auth";

export const ROOT_ADMIN_EMAIL = "admin@gmail.com";

export function isRootAdminEmail(email?: string | null) {
  return String(email ?? "").trim().toLowerCase() === ROOT_ADMIN_EMAIL;
}

export function isRootAdminSession(session: CurrentSession | null) {
  return isRootAdminEmail(session?.user.email) || isRootAdminEmail(session?.user.rootAdminEmail);
}

export function isViewingAsAdmin(session: CurrentSession | null) {
  return Boolean(session?.user.impersonatingAdminId);
}
