import { fail, ok, serverError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { clearAuthCookies, requireUser, verifyPassword } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function DELETE(req: Request) {
  try {
    const session = await requireUser();
    const body = await req.json().catch(() => ({}));
    const password = String(body.password ?? "");
    if (!password) return fail("Vui long nhap mat khau hien tai de xoa tai khoan.", 422);

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, email: true, passwordHash: true, status: true },
    });
    if (!user || user.status !== "ACTIVE") return fail("Khong tim thay tai khoan.", 404);

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return fail("Mat khau hien tai khong dung.", 401);

    const deletedAt = Date.now();

    await writeAuditLog(session, "DELETE_ACCOUNT", "User", session.id, { email: user.email });
    await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: { userId: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: session.id },
        data: {
          status: "DELETED",
          email: `deleted-${session.id}-${deletedAt}@deleted.local`,
          name: "Tai khoan da xoa",
          phone: null,
          avatarUrl: null,
        },
      }),
    ]);

    await clearAuthCookies();
    return ok({ deleted: true });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chua dang nhap.", 401);
    return serverError(error);
  }
}
