import { fail, ok, created, serverError } from "@/app/lib/api-response";
import { canCreate, canUpdate, requireUser, verifyStudioEditPassword } from "@/app/lib/auth";
import { writeAuditLog } from "@/app/lib/audit";
import { applyTransactionWalletDelta, recalculateInvoiceDebt, replaceTransactionWalletDelta } from "@/app/lib/finance-workflow";
import { cacheInvalidate } from "@/app/lib/api-cache";
import { prisma } from "@/app/lib/prisma";
import { sendStudioPush } from "@/app/lib/push";
import {
  getDelegate,
  getResourceDefinition,
  normalizePayload,
  type ResourceKey,
} from "@/app/lib/resources";
import { resourcePayloadSchema } from "@/app/lib/validators";

function resolveResource(resourceName: string) {
  const definition = getResourceDefinition(resourceName);
  if (!definition) return null;
  return {
    key: resourceName as ResourceKey,
    definition,
    delegate: getDelegate(resourceName as ResourceKey),
  };
}

function isTrashable(definition: Record<string, unknown>) {
  return definition.trashable === true;
}

function resourceInclude(resource: ResourceKey) {
  const projectWithBookingPackage = {
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      invoices: {
        where: { deletedAt: null },
        select: {
          id: true,
          code: true,
          note: true,
          total: true,
          paid: true
        }
      },
      booking: {
        select: {
          id: true,
          package: {
            select: {
              id: true,
              imageUrl: true,
              galleryUrls: true
            }
          }
        }
      }
    }
  };

  if (resource === "invoices") {
    return {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          avatarUrl: true
        }
      },
      project: projectWithBookingPackage,
      items: true
    };
  }

  if (resource === "transactions") {
    return {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          avatarUrl: true
        }
      },
      project: projectWithBookingPackage
    };
  }

  if (resource === "projects") {
    return {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          avatarUrl: true
        }
      },
      booking: {
        select: {
          id: true,
          package: {
            select: {
              id: true,
              imageUrl: true,
              galleryUrls: true
            }
          }
        }
      }
    };
  }

  return undefined;
}

function auditName(row: Record<string, unknown>) {
  return String(row.name ?? row.title ?? row.customerName ?? row.code ?? row.filename ?? "").trim() || undefined;
}

async function openShiftForTransaction(studioId: string, payload: Record<string, unknown>) {
  const walletId = String(payload.walletId ?? "");
  if (!walletId) return null;
  const occurredAt = payload.occurredAt ? new Date(String(payload.occurredAt)) : new Date();
  return prisma.walletShift.findFirst({
    where: {
      studioId,
      walletId,
      status: "OPEN",
      openedAt: { lte: occurredAt },
    },
    orderBy: { openedAt: "desc" },
    select: { id: true },
  });
}

export async function getResource(req: Request, resourceName: string) {
  try {
    const user = await requireUser();
    const resource = resolveResource(resourceName);
    if (!resource) return fail("Không tìm thấy tài nguyên.", 404);

    const url = new URL(req.url);
    const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 50), 1), 100);
    const cursor = url.searchParams.get("cursor");
    const cursorMode = url.searchParams.get("cursorMode") === "1";
    const trash = url.searchParams.get("trash") === "1";
    const rows = await resource.delegate.findMany({
      where: {
        studioId: user.studioId,
        ...(isTrashable(resource.definition) ? { deletedAt: trash ? { not: null } : null } : {}),
      },
      include: resourceInclude(resource.key),
      take: cursorMode ? take + 1 : take,
      ...(cursorMode && cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
    });

    if (cursorMode) {
      const hasMore = rows.length > take;
      const items = hasMore ? rows.slice(0, take) : rows;
      const last = items[items.length - 1];
      return ok({
        items,
        nextCursor: hasMore && last ? String(last.id ?? "") : null,
        hasMore,
      });
    }

    return ok(rows, {
      headers: {
        "Cache-Control": "private, max-age=5, stale-while-revalidate=15",
      },
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function createResource(req: Request, resourceName: string) {
  try {
    const user = await requireUser();
    if (!canCreate(user.role)) return fail("Chỉ quản trị viên hoặc quản lý được thêm dữ liệu.", 403);

    const resource = resolveResource(resourceName);
    if (!resource) return fail("Không tìm thấy tài nguyên.", 404);

    const parsed = resourcePayloadSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.", 422, parsed.error.flatten());

    if (resource.key === "bookings") {
      const payload = normalizePayload(resource.key, parsed.data);
      const existed = await resource.delegate.findFirst({
        where: {
          studioId: user.studioId,
          deletedAt: null,
          status: { not: "CANCELLED" },
          startAt: { lt: payload.endAt },
          endAt: { gt: payload.startAt },
          OR: [{ studioRoom: payload.studioRoom ?? undefined }],
        },
      });
      if (existed) return fail("Lịch này bị trùng phòng hoặc khung giờ.", 409);
    }

    const payload = normalizePayload(resource.key, parsed.data);
    if (resource.key === "transactions") {
      const shift = await openShiftForTransaction(user.studioId, payload);
      if (shift?.id) payload.walletShiftId = shift.id;
    }
    const row = await resource.delegate.create({
      data: { ...payload, studioId: user.studioId },
    });
    if (resource.key === "transactions") await applyTransactionWalletDelta(row, 1);
    if (resource.key === "invoices") await recalculateInvoiceDebt(String(row.id));
    await writeAuditLog(user, "CREATE", resource.definition.entity, String(row.id), { name: auditName(row) });
    cacheInvalidate("dashboard:");

    if (resource.key === "notifications") {
      const notification = row as any;
      if (notification.dueAt && new Date(notification.dueAt) > new Date() && !notification.isRead) {
        await sendStudioPush(user.studioId, { title: notification.title, body: notification.message, url: "/", tag: notification.id });
      }
    }

    return created(row);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function updateResource(req: Request, resourceName: string) {
  try {
    const user = await requireUser();
    if (!canUpdate(user.role)) return fail("Bạn không có quyền cập nhật dữ liệu.", 403);

    const resource = resolveResource(resourceName);
    if (!resource) return fail("Không tìm thấy tài nguyên.", 404);

    const body = await req.json();
    const parsed = resourcePayloadSchema.safeParse(body);
    if (!parsed.success || !body.id) return fail("Dữ liệu cập nhật không hợp lệ.", 422);
    if (!(await verifyStudioEditPassword(user, body.studioPassword))) {
      return fail("Mật khẩu studio không đúng. Nhân viên cần nhập mật khẩu studio để sửa dữ liệu.", 401);
    }

    const current = await resource.delegate.findFirst({
      where: { id: body.id, studioId: user.studioId },
    });
    if (!current) return fail("Không tìm thấy bản ghi.", 404);

    const payload = normalizePayload(resource.key, parsed.data);
    if (resource.key === "transactions") {
      const shift = await openShiftForTransaction(user.studioId, payload);
      payload.walletShiftId = shift?.id ?? null;
    }
    const row = await resource.delegate.update({
      where: { id: body.id },
      data: payload,
    });
    if (resource.key === "transactions") await replaceTransactionWalletDelta(current, row);
    if (resource.key === "invoices") await recalculateInvoiceDebt(String(row.id));
    await writeAuditLog(user, "UPDATE", resource.definition.entity, String(row.id), { name: auditName(row) });
    cacheInvalidate("dashboard:");

    if (resource.key === "notifications") {
      const notification = row as any;
      if (notification.dueAt && new Date(notification.dueAt) > new Date() && !notification.isRead) {
        await sendStudioPush(user.studioId, { title: notification.title, body: notification.message, url: "/", tag: notification.id });
      }
    }

    return ok(row);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function deleteResource(req: Request, resourceName: string) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return fail("Chỉ quản trị viên được xóa dữ liệu.", 403);

    const resource = resolveResource(resourceName);
    if (!resource) return fail("Không tìm thấy tài nguyên.", 404);

    const { id, mode } = await req.json();
    if (!id) return fail("Thiếu mã bản ghi.", 422);

    const current = await resource.delegate.findFirst({
      where: { id, studioId: user.studioId },
    });
    if (!current) return fail("Không tìm thấy bản ghi.", 404);

    if (mode === "hard") {
      if (resource.key === "transactions") await applyTransactionWalletDelta(current, -1);
      await resource.delegate.delete({ where: { id } });
      await writeAuditLog(user, "DELETE", resource.definition.entity, id, { name: auditName(current) });
      return ok({ id, mode: "hard" });
    }

    if (resource.key === "transactions") await applyTransactionWalletDelta(current, -1);
    await resource.delegate.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAuditLog(user, "TRASH", resource.definition.entity, id, { name: auditName(current) });
    return ok({ id, mode: "trash" });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function restoreResource(req: Request, resourceName: string) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return fail("Chỉ quản trị viên được khôi phục dữ liệu.", 403);
    const resource = resolveResource(resourceName);
    if (!resource) return fail("Không tìm thấy tài nguyên.", 404);
    const { id } = await req.json();
    if (!id) return fail("Thiếu mã bản ghi.", 422);
    const row = await resource.delegate.update({ where: { id }, data: { deletedAt: null } });
    if (resource.key === "transactions") await applyTransactionWalletDelta(row, 1);
    await writeAuditLog(user, "RESTORE", resource.definition.entity, id, { name: auditName(row) });
    return ok({ id });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
