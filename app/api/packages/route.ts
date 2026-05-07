import { created, fail, ok, serverError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { canCreate, canUpdate, requireUser, verifyStudioEditPassword } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

function normalizePrice(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeGallery(value: unknown) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed)) return null;
    return JSON.stringify(parsed.filter((item) => typeof item === "string" && item.trim()).slice(0, 4));
  } catch {
    return null;
  }
}

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function packagePayload(body: Record<string, unknown>, categoryId: string) {
  return {
    categoryId,
    name: String(body.name).trim(),
    price: normalizePrice(body.price),
    description: cleanText(body.description),
    duration: cleanText(body.duration),
    suitableFor: cleanText(body.suitableFor),
    includes: cleanText(body.includes),
    deliverables: cleanText(body.deliverables),
    outfitCount: cleanText(body.outfitCount),
    peopleCount: cleanText(body.peopleCount),
    location: cleanText(body.location),
    customerNote: cleanText(body.customerNote),
    imageUrl: cleanText(body.imageUrl),
    galleryUrls: normalizeGallery(body.galleryUrls),
  };
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const trash = url.searchParams.get("trash") === "1";
    const cursorMode = url.searchParams.get("cursorMode") === "1";
    const cursor = url.searchParams.get("cursor");
    const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 80), 1), 150);
    const rows = await prisma.package.findMany({
      where: { studioId: user.studioId, deletedAt: trash ? { not: null } : null },
      include: { category: true },
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
    if (!canCreate(user.role)) return fail("Chỉ quản trị viên hoặc quản lý được thêm gói.", 403);

    const body = await req.json();
    if (!String(body.name ?? "").trim()) return fail("Tên gói là bắt buộc.", 422);
    if (!body.categoryId) return fail("Vui lòng chọn danh mục.", 422);

    const category = await prisma.category.findFirst({ where: { id: body.categoryId, studioId: user.studioId, deletedAt: null } });
    if (!category) return fail("Danh mục không hợp lệ.", 422);

    const row = await prisma.package.create({
      data: {
        studioId: user.studioId,
        ...packagePayload(body, category.id),
      },
      include: { category: true },
    });
    await writeAuditLog(user, "CREATE", "Package", row.id, { name: row.name });
    return created(row);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    if (!canUpdate(user.role)) return fail("Bạn không có quyền sửa gói.", 403);

    const body = await req.json();
    if (!body.id) return fail("Thiếu mã gói.", 422);
    if (!(await verifyStudioEditPassword(user, body.studioPassword))) return fail("Mật khẩu studio không đúng. Nhân viên cần nhập mật khẩu studio để sửa gói.", 401);
    if (!String(body.name ?? "").trim()) return fail("Tên gói là bắt buộc.", 422);
    if (!body.categoryId) return fail("Vui lòng chọn danh mục.", 422);

    const [current, category] = await Promise.all([
      prisma.package.findFirst({ where: { id: body.id, studioId: user.studioId, deletedAt: null } }),
      prisma.category.findFirst({ where: { id: body.categoryId, studioId: user.studioId, deletedAt: null } }),
    ]);
    if (!current) return fail("Không tìm thấy gói.", 404);
    if (!category) return fail("Danh mục không hợp lệ.", 422);

    const row = await prisma.package.update({
      where: { id: body.id },
      data: packagePayload(body, category.id),
      include: { category: true },
    });
    await writeAuditLog(user, "UPDATE", "Package", row.id, { name: row.name });
    return ok(row);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return fail("Chỉ quản trị viên được xóa gói.", 403);

    const { id, mode } = await req.json();
    if (!id) return fail("Thiếu mã gói.", 422);

    if (mode === "hard") {
      const used = await prisma.booking.count({ where: { packageId: id, studioId: user.studioId } });
      if (used > 0) return fail("Gói này đang liên kết với booking. Hãy chuyển vào thùng rác thay vì xóa hẳn.", 409);
      await prisma.package.deleteMany({ where: { id, studioId: user.studioId } });
      await writeAuditLog(user, "DELETE", "Package", String(id));
    } else {
      const row = await prisma.package.findFirst({ where: { id, studioId: user.studioId } });
      await prisma.package.updateMany({
        where: { id, studioId: user.studioId },
        data: { deletedAt: new Date() },
      });
      await writeAuditLog(user, "TRASH", "Package", String(id), { name: row?.name });
    }
    return ok({ id });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
