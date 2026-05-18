import { fail, ok, serverError } from "@/app/lib/api-response";
import { isRootAdmin, requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { isRootAdminEmail } from "@/app/utils/root-admin";

function adminRow(user: {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  studio: { id: string; name: string; slug: string } | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    studio: user.studio ? {
      id: user.studio.id,
      name: user.studio.name,
      slug: user.studio.slug,
    } : null,
  };
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!isRootAdmin(user)) return fail("Chỉ admin chính được xem danh sách admin.", 403);

    const rows = await prisma.user.findMany({
      where: {
        email: { not: user.email },
        role: { name: "ADMIN" },
        status: "ACTIVE",
      },
      include: { studio: true, role: true },
      orderBy: { createdAt: "desc" },
    });

    return ok(rows.filter((row) => !isRootAdminEmail(row.email)).map(adminRow));
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Bạn chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (!isRootAdmin(user)) return fail("Chỉ admin chính được xóa admin.", 403);

    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? "");
    if (!id) return fail("Thiếu mã admin.", 422);

    const target = await prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!target || target.role?.name !== "ADMIN" || target.status !== "ACTIVE") return fail("Không tìm thấy admin cần xóa.", 404);
    if (isRootAdminEmail(target.email)) return fail("Không thể xóa admin chính.", 403);

    await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: target.id },
        data: { status: "DISABLED", email: `disabled-${target.id}-${target.email}` },
      }),
    ]);

    return ok({ id: target.id });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Bạn chưa đăng nhập.", 401);
    return serverError(error);
  }
}
