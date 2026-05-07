import { created, fail, ok, serverError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { canCreate, canUpdate, requireUser, verifyStudioEditPassword } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const trash = url.searchParams.get("trash") === "1";
    const cursorMode = url.searchParams.get("cursorMode") === "1";
    const cursor = url.searchParams.get("cursor");
    const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 80), 1), 150);
    const rows = await prisma.category.findMany({
      where: { studioId: user.studioId, deletedAt: trash ? { not: null } : null },
      orderBy: { createdAt: "desc" },
      take: cursorMode ? take + 1 : undefined,
      ...(cursorMode && cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (cursorMode) {
      const hasMore = rows.length > take;
      const items = hasMore ? rows.slice(0, take) : rows;
      return ok({ items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null, hasMore });
    }
    return ok(rows);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!canCreate(user.role)) return fail("Chỉ quản trị viên hoặc quản lý được thêm danh mục.", 403);
    const body = await req.json();
    if (!String(body.name ?? "").trim()) return fail("Tên danh mục là bắt buộc.", 422);

    const row = await prisma.category.create({
      data: {
        studioId: user.studioId,
        name: String(body.name).trim(),
        description: body.description ? String(body.description).trim() : null,
      },
    });
    await writeAuditLog(user, "CREATE", "Category", row.id, { name: row.name });
    return created(row);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    if (!canUpdate(user.role)) return fail("Bạn không có quyền sửa danh mục.", 403);
    const body = await req.json();
    if (!body.id) return fail("Thiếu mã danh mục.", 422);
    if (!(await verifyStudioEditPassword(user, body.studioPassword))) return fail("Mật khẩu studio không đúng. Nhân viên cần nhập mật khẩu studio để sửa danh mục.", 401);
    if (!String(body.name ?? "").trim()) return fail("Tên danh mục là bắt buộc.", 422);

    const current = await prisma.category.findFirst({ where: { id: body.id, studioId: user.studioId, deletedAt: null } });
    if (!current) return fail("Không tìm thấy danh mục.", 404);

    const row = await prisma.category.update({
      where: { id: body.id },
      data: {
        name: String(body.name).trim(),
        description: body.description ? String(body.description).trim() : null,
      },
    });
    await writeAuditLog(user, "UPDATE", "Category", row.id, { name: row.name });
    return ok(row);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return fail("Chỉ quản trị viên được xóa danh mục.", 403);
    const { id, mode } = await req.json();
    if (!id) return fail("Thiếu mã danh mục.", 422);

    if (mode === "hard") {
      const used = await prisma.package.count({ where: { categoryId: id, studioId: user.studioId } });
      if (used > 0) return fail("Danh mục đang có gói dịch vụ. Hãy chuyển vào thùng rác thay vì xóa hẳn.", 409);
      await prisma.category.delete({ where: { id } });
      await writeAuditLog(user, "DELETE", "Category", String(id));
    } else {
      const row = await prisma.category.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await writeAuditLog(user, "TRASH", "Category", String(id), { name: row.name });
    }

    return ok({ id });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
