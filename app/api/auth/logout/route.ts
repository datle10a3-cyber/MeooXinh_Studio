import { cookies } from "next/headers";
import { ok } from "@/app/lib/api-response";
import { authCookieNames, clearAuthCookies, getCurrentUser, hashToken } from "@/app/lib/auth";
import { writeAuditLog } from "@/app/lib/audit";
import { prisma } from "@/app/lib/prisma";

export async function POST() {
  const store = await cookies();
  const refreshToken = store.get(authCookieNames.refreshCookie)?.value;
  const user = await getCurrentUser().catch(() => null);
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  if (user) await writeAuditLog(user, "LOGOUT", "Auth", user.id, { name: user.name });
  await clearAuthCookies();
  return ok({ message: "Đã đăng xuất." });
}
