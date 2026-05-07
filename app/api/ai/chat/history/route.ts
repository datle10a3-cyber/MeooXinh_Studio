import { fail, ok, serverError } from "@/app/lib/api-response";
import { requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await prisma.aiChatMessage.findMany({
      where: { studioId: user.studioId, userId: user.id },
      orderBy: { createdAt: "asc" },
      take: 80,
      select: { id: true, role: true, content: true, createdAt: true },
    });
    return ok(rows);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return fail("Chỉ quản trị viên được xóa lịch sử trò chuyện.", 403);
    await prisma.aiChatMessage.deleteMany({
      where: { studioId: user.studioId, userId: user.id },
    });
    return ok({ cleared: true });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
