import { fail, ok, serverError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { authCookieNames, hashPassword, hashToken, requireUser, verifyPassword } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { strongPasswordMessage } from "@/app/lib/security";
import { cookies } from "next/headers";

export async function PATCH(req: Request) {
  try {
    const session = await requireUser();
    const body = await req.json();
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      return fail("Vui long nhap day du mat khau.", 422);
    }
    if (newPassword !== confirmPassword) {
      return fail("Mat khau xac nhan khong khop.", 422);
    }
    if (newPassword === currentPassword) {
      return fail("Mat khau moi phai khac mat khau hien tai.", 422);
    }
    const passwordError = strongPasswordMessage(newPassword);
    if (passwordError) return fail(passwordError, 422);

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, passwordHash: true },
    });
    if (!user) return fail("Khong tim thay tai khoan.", 404);

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return fail("Mat khau hien tai khong dung.", 401);

    await prisma.user.update({
      where: { id: session.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    const store = await cookies();
    const currentRefreshToken = store.get(authCookieNames.refreshCookie)?.value;
    const currentTokenHash = currentRefreshToken ? hashToken(currentRefreshToken) : "";
    await prisma.refreshToken.updateMany({
      where: {
        userId: session.id,
        revokedAt: null,
        ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    await writeAuditLog(session, "UPDATE_PASSWORD", "profile", session.id);

    return ok({ changed: true });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chua dang nhap.", 401);
    return serverError(error);
  }
}
