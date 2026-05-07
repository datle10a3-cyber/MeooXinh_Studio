import { fail, ok, serverError } from "@/app/lib/api-response";
import { canViewStudioFinance } from "@/app/lib/ai-studio";
import { requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    if (!canViewStudioFinance(user.role)) return fail("Chỉ Quản trị viên hoặc Quản lý mới được xem nhật ký AI.", 403);
    const rows = await prisma.aiAuditLog.findMany({
      where: { studioId: user.studioId },
      include: { user: { select: { name: true, role: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return ok(rows);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
