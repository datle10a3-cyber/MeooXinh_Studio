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
  counts?: {
    customers: number;
    bookings: number;
    transactions: number;
    invoices: number;
  };
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
    counts: user.counts,
  };
}

async function enrichAdminRows<T extends { studioId: string }>(rows: T[]) {
  return Promise.all(rows.map(async (row) => {
    const [customers, bookings, transactions, invoices] = await Promise.all([
      prisma.customer.count({ where: { studioId: row.studioId, deletedAt: null } }),
      prisma.booking.count({ where: { studioId: row.studioId, deletedAt: null } }),
      prisma.transaction.count({ where: { studioId: row.studioId, deletedAt: null } }),
      prisma.invoice.count({ where: { studioId: row.studioId, deletedAt: null } }),
    ]);
    return { ...row, counts: { customers, bookings, transactions, invoices } };
  }));
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!isRootAdmin(user)) return fail("Chỉ Super Admin được xem danh sách admin.", 403);

    const rows = await prisma.user.findMany({
      where: {
        email: { not: user.email },
        role: { name: "ADMIN" },
        status: { in: ["ACTIVE", "DISABLED", "DELETED"] },
      },
      include: { studio: true, role: true },
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
    });

    const adminRows = rows.filter((row) => !isRootAdminEmail(row.email));
    const enrichedRows = await enrichAdminRows(adminRows);

    return ok(enrichedRows.map(adminRow));
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Bạn chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    if (!isRootAdmin(user)) return fail("Chỉ Super Admin được quản lý admin.", 403);

    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? "");
    const action = String(body.action ?? "");
    if (!id) return fail("Thiếu mã admin.", 422);
    if (!["disable", "enable", "restore"].includes(action)) return fail("Thao tác không hợp lệ.", 422);

    const target = await prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!target || target.role?.name !== "ADMIN") return fail("Không tìm thấy admin cần quản lý.", 404);
    if (isRootAdminEmail(target.email)) return fail("Không thể thay đổi Super Admin.", 403);

    const nextStatus = action === "disable" ? "DISABLED" : "ACTIVE";
    if (action === "disable" && target.status !== "ACTIVE") return fail("Chỉ khóa được admin đang hoạt động.", 422);
    if (action === "enable" && target.status !== "DISABLED") return fail("Chỉ mở khóa được admin đang bị khóa.", 422);
    if (action === "restore" && target.status !== "DELETED") return fail("Chỉ khôi phục được admin đã xóa.", 422);

    await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: target.id },
        data: { status: nextStatus },
      }),
    ]);

    return ok({ id: target.id, status: nextStatus });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Bạn chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (!isRootAdmin(user)) return fail("Chỉ Super Admin được xóa admin.", 403);

    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? "");
    if (!id) return fail("Thiếu mã admin.", 422);

    const target = await prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!target || target.role?.name !== "ADMIN" || target.status === "DELETED") return fail("Không tìm thấy admin cần xóa.", 404);
    if (isRootAdminEmail(target.email)) return fail("Không thể xóa Super Admin.", 403);

    await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: target.id },
        data: { status: "DELETED" },
      }),
    ]);

    return ok({ id: target.id, status: "DELETED" });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Bạn chưa đăng nhập.", 401);
    return serverError(error);
  }
}
