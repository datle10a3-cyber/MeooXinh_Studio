import { fail, ok, serverError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { hashPassword, requireUser, verifyPassword } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function PATCH(req: Request) {
  try {
    const session = await requireUser();
    if (session.role !== "ADMIN") return fail("Chỉ quản trị viên mới được đổi mật khẩu studio.", 403);

    const body = await req.json().catch(() => ({}));
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword.trim() : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword.trim() : "";
    const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword.trim() : "";

    if (!currentPassword || !newPassword || !confirmPassword) return fail("Vui lòng nhập đầy đủ mật khẩu studio.", 422);
    if (!/^\d{6}$/.test(currentPassword) || !/^\d{6}$/.test(newPassword) || !/^\d{6}$/.test(confirmPassword)) {
      return fail("Mật khẩu studio phải gồm đúng 6 số.", 422);
    }
    if (newPassword !== confirmPassword) return fail("Mật khẩu xác nhận không khớp.", 422);
    if (newPassword === currentPassword) return fail("Mật khẩu mới phải khác mật khẩu hiện tại.", 422);

    const studio = await prisma.studio.findUnique({
      where: { id: session.studioId },
      select: { id: true, shiftPasswordHash: true },
    });
    if (!studio) return fail("Không tìm thấy studio.", 404);

    const valid = studio.shiftPasswordHash ? await verifyPassword(currentPassword, studio.shiftPasswordHash) : currentPassword === "000000";
    if (!valid) return fail("Mật khẩu studio hiện tại không đúng.", 401);

    await prisma.studio.update({
      where: { id: session.studioId },
      data: { shiftPasswordHash: await hashPassword(newPassword) },
    });

    await writeAuditLog(session, "UPDATE_STUDIO_PASSWORD", "studio", session.studioId);
    return ok({ changed: true });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
