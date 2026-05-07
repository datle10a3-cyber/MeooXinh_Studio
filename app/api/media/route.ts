import { fail, ok, serverError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { requireUser } from "@/app/lib/auth";
import { uploadMediaFile } from "@/app/lib/media-service";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 60), 1), 100);
    const cursor = url.searchParams.get("cursor");
    const cursorMode = url.searchParams.get("cursorMode") === "1";
    const media = await prisma.media.findMany({
      where: { studioId: user.studioId },
      orderBy: { createdAt: "desc" },
      take: cursorMode ? take + 1 : take,
      ...(cursorMode && cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (cursorMode) {
      const hasMore = media.length > take;
      const items = hasMore ? media.slice(0, take) : media;
      const last = items[items.length - 1];
      return ok({
        items,
        nextCursor: hasMore && last ? last.id : null,
        hasMore,
      });
    }

    return ok(media);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    if ((error as Error).message) return fail((error as Error).message, 422);
    return serverError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("Vui lòng chọn file ảnh.", 422);
    if (!file.type.startsWith("image/")) return fail("Chỉ hỗ trợ upload ảnh.", 422);

    const uploaded = await uploadMediaFile(file);
    const row = await prisma.media.create({
      data: {
        studioId: user.studioId,
        userId: user.id,
        url: uploaded.url,
        publicId: uploaded.publicId,
        filename: file.name,
        mimeType: file.type,
        type: "IMAGE",
        size: file.size,
        provider: uploaded.provider,
      },
    });

    await writeAuditLog(user, "UPLOAD", "Media", row.id, { name: row.filename });
    return ok(row, { status: 201 });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return fail("Chỉ quản trị viên được xóa ảnh.", 403);

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter((item: unknown): item is string => typeof item === "string") : [];

    if (body.all === true) {
      const result = await prisma.media.deleteMany({ where: { studioId: user.studioId } });
      await writeAuditLog(user, "DELETE", "Media", "ALL", { count: result.count, scope: "Toàn bộ thư viện ảnh" });
      return ok({ deleted: result.count });
    }

    if (ids.length) {
      const result = await prisma.media.deleteMany({ where: { id: { in: ids }, studioId: user.studioId } });
      await writeAuditLog(user, "DELETE", "Media", "BULK", { count: result.count, ids });
      return ok({ deleted: result.count });
    }

    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return fail("Thiếu mã ảnh.", 422);

    const row = await prisma.media.findFirst({ where: { id, studioId: user.studioId } });
    await prisma.media.deleteMany({ where: { id, studioId: user.studioId } });
    await writeAuditLog(user, "DELETE", "Media", String(id), { name: row?.filename });
    return ok({ id, deleted: row ? 1 : 0 });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
