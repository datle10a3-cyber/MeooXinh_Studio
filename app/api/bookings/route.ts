import { created, fail, ok, serverError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { canCreate, canUpdate, requireUser, verifyStudioEditPassword } from "@/app/lib/auth";
import {
  bookingGroupNameFromNote,
  finalizeCompletedBooking,
  finalizeCompletedBookingGroup,
  nextGroupInvoiceCode,
  nextStudioInvoiceCode,
  noteWithReservedInvoiceCode,
  reservedInvoiceCodeFromNote,
} from "@/app/lib/finance-workflow";
import { prisma } from "@/app/lib/prisma";
import type { Prisma } from "@prisma/client";

function parseDate(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveDiscount(body: Record<string, unknown>, packagePrice: unknown) {
  const price = Number(packagePrice ?? 0);
  const discountType = String(body.discountType ?? "NONE");
  const discountValue = Math.max(0, Number(body.discountValue ?? 0));
  const discount = discountType === "PERCENT"
    ? Math.min(price, Math.round(price * Math.min(discountValue, 100) / 100))
    : discountType === "AMOUNT"
      ? Math.min(price, discountValue)
      : 0;
  return {
    total: Math.max(0, price - discount),
    discount,
    label: discount > 0 ? `Giảm giá: ${discount.toLocaleString("vi-VN")} đ${discountType === "PERCENT" ? ` (${discountValue}%)` : ""}` : "",
  };
}

function appendBookingNote(note: unknown, discountLabel: string, bookingMode: string, groupLabel?: string) {
  const parts = [String(note ?? "").trim()].filter(Boolean);
  if (bookingMode === "GROUP") parts.push(`Loại booking: Booking nhóm${groupLabel ? ` - ${groupLabel}` : ""}.`);
  if (discountLabel) parts.push(discountLabel);
  return parts.length ? parts.join("\n") : null;
}

function invoiceCodeNumber(code: string, group: boolean) {
  const match = (group ? /^Group-meoxinh(\d+)$/i : /^meoxinh(\d+)$/i).exec(code);
  return match ? Number(match[1]) : 0;
}

async function nextReservedAwareInvoiceCode(tx: Prisma.TransactionClient, studioId: string, group: boolean) {
  const baseCode = group ? await nextGroupInvoiceCode(tx, studioId) : await nextStudioInvoiceCode(tx, studioId);
  const bookings = await tx.booking.findMany({
    where: { studioId, deletedAt: null, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    select: { note: true },
  });
  const mode = group ? "group" : "personal";
  const reservedMax = bookings.reduce((max, booking) => {
    const code = reservedInvoiceCodeFromNote(booking.note, mode);
    return Math.max(max, invoiceCodeNumber(code, group));
  }, 0);
  const nextNumber = Math.max(invoiceCodeNumber(baseCode, group), reservedMax + 1);
  return `${group ? "Group-meoxinh" : "meoxinh"}${String(nextNumber).padStart(2, "0")}`;
}

function bookingSelect() {
  return {
    package: { include: { category: true } },
    customer: true,
  };
}

async function ensureOpenPaymentShift(studioId: string) {
  const openShifts = await prisma.walletShift.findMany({
    where: { studioId, status: "OPEN" },
    select: { id: true, walletId: true },
  });
  if (openShifts.length > 0) {
    const activeWalletWithShift = await prisma.wallet.findFirst({
      where: {
        studioId,
        id: { in: openShifts.map((s) => s.walletId) },
        deletedAt: null,
        isActive: true,
      },
    });
    if (activeWalletWithShift) return null;
  }

  const hasWallet = await prisma.wallet.findFirst({
    where: { studioId, deletedAt: null, isActive: true },
  });
  if (!hasWallet) return "Chưa có ví tiền. Vui lòng tạo ví và mở ca trước khi thanh toán booking.";
  return "Chưa mở ca. Vui lòng vào Ví mở ca trước khi thanh toán booking.";
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const searchParams = new URL(request.url).searchParams;
    const view = searchParams.get("view");
    const status = searchParams.get("status");
    const cursorMode = searchParams.get("cursorMode") === "1";
    const cursor = searchParams.get("cursor");
    const take = Math.min(Math.max(Number(searchParams.get("take") ?? 80), 1), 150);

    const statusWhere =
      view === "completed" || status === "COMPLETED"
        ? { status: "COMPLETED" }
        : view === "all"
          ? {}
          : { status: { notIn: ["COMPLETED", "CANCELLED"] } };

    const rows = await prisma.booking.findMany({
      where: { studioId: user.studioId, deletedAt: null, ...statusWhere },
      include: bookingSelect(),
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
    if (!canCreate(user.role)) return fail("Chỉ quản trị viên hoặc quản lý được thêm booking.", 403);

    const body = await req.json();
    if (!String(body.customerName ?? "").trim()) return fail("Tên khách hàng là bắt buộc.", 422);
    if (!body.packageId) return fail("Vui lòng chọn gói dịch vụ.", 422);

    const startTime = parseDate(body.startTime);
    const endTime = parseDate(body.endTime);
    if (!startTime) return fail("Vui lòng chọn ngày giờ bắt đầu.", 422);

    const selectedPackage = await prisma.package.findFirst({
      where: { id: body.packageId, studioId: user.studioId, deletedAt: null },
      include: { category: true },
    });
    if (!selectedPackage) return fail("Gói dịch vụ không hợp lệ.", 422);

    const customerName = String(body.customerName).trim();
    const finishTime = endTime ?? new Date(startTime.getTime() + 60 * 60 * 1000);
    const status = body.status ? String(body.status) : "PENDING";
    if (status === "COMPLETED") {
      const shiftError = await ensureOpenPaymentShift(user.studioId);
      if (shiftError) return fail(shiftError, 409);
    }

    const discountInfo = resolveDiscount(body as Record<string, unknown>, selectedPackage.price);
    const bookingMode = String(body.bookingMode ?? "PERSONAL");
    const row = await prisma.booking.create({
      data: {
        studioId: user.studioId,
        customerId: body.customerId ? String(body.customerId) : null,
        packageId: selectedPackage.id,
        customerName,
        imageUrl: body.imageUrl ? String(body.imageUrl).trim() : null,
        packageName: selectedPackage.name,
        categoryName: selectedPackage.category.name,
        price: selectedPackage.price,
        startTime,
        endTime: finishTime,
        title: `${customerName} - ${selectedPackage.name}`,
        startAt: startTime,
        endAt: finishTime,
        total: discountInfo.total,
        status,
        note: appendBookingNote(body.note, discountInfo.label, bookingMode, body.groupLabel ? String(body.groupLabel) : undefined),
      },
      include: bookingSelect(),
    });

    let invoiceSnapshot = null;
    if (status === "COMPLETED") {
      try {
        invoiceSnapshot = await finalizeCompletedBooking(row, user);
      } catch (finalizeError) {
        // Roll back — delete the booking so data stays consistent
        await prisma.booking.delete({ where: { id: row.id } }).catch(() => null);
        throw finalizeError;
      }
    }

    await writeAuditLog(user, "CREATE", "Booking", row.id, { customerName: row.customerName, name: row.packageName });
    return created({ ...row, ...(invoiceSnapshot ?? {}) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    if (!canUpdate(user.role)) return fail("Bạn không có quyền sửa booking.", 403);

    const body = await req.json();
    if (!body.id) return fail("Thiếu mã booking.", 422);
    if (!(await verifyStudioEditPassword(user, body.studioPassword))) return fail("Mật khẩu studio không đúng. Nhân viên cần nhập mật khẩu studio để sửa booking.", 401);
    if (!String(body.customerName ?? "").trim()) return fail("Tên khách hàng là bắt buộc.", 422);
    if (!body.packageId) return fail("Vui lòng chọn gói dịch vụ.", 422);

    const startTime = parseDate(body.startTime);
    const endTime = parseDate(body.endTime);
    if (!startTime) return fail("Vui lòng chọn ngày giờ bắt đầu.", 422);

    const [current, selectedPackage] = await Promise.all([
      prisma.booking.findFirst({ where: { id: body.id, studioId: user.studioId, deletedAt: null } }),
      prisma.package.findFirst({
        where: { id: body.packageId, studioId: user.studioId, deletedAt: null },
        include: { category: true },
      }),
    ]);
    if (!current) return fail("Không tìm thấy booking.", 404);
    if (!selectedPackage) return fail("Gói dịch vụ không hợp lệ.", 422);

    const customerName = String(body.customerName).trim();
    const finishTime = endTime ?? new Date(startTime.getTime() + 60 * 60 * 1000);
    const status = body.status ? String(body.status) : "PENDING";
    const isNewlyCompleting = current.status !== "COMPLETED" && status === "COMPLETED";
    if (isNewlyCompleting) {
      const shiftError = await ensureOpenPaymentShift(user.studioId);
      if (shiftError) return fail(shiftError, 409);
    }

    const discountInfo = resolveDiscount(body as Record<string, unknown>, selectedPackage.price);
    const bookingMode = String(body.bookingMode ?? "PERSONAL");
    const nextTotal = body.discountType === undefined ? current.total : discountInfo.total;
    const reservedInvoiceCode = reservedInvoiceCodeFromNote(current.note, "group") || reservedInvoiceCodeFromNote(current.note, "personal");
    const rawNextNote = body.discountType === undefined
      ? (body.note ? String(body.note).trim() : null)
      : appendBookingNote(body.note, discountInfo.label, bookingMode, body.groupLabel ? String(body.groupLabel) : undefined);
    const bookingData = {
      customerId: body.customerId ? String(body.customerId) : null,
      packageId: selectedPackage.id,
      customerName,
      imageUrl: body.imageUrl ? String(body.imageUrl).trim() : null,
      packageName: selectedPackage.name,
      categoryName: selectedPackage.category.name,
      price: selectedPackage.price,
      startTime,
      endTime: finishTime,
      title: `${customerName} - ${selectedPackage.name}`,
      startAt: startTime,
      endAt: finishTime,
      total: nextTotal,
      status,
      note: reservedInvoiceCode ? noteWithReservedInvoiceCode(rawNextNote, reservedInvoiceCode) : rawNextNote,
    };

    let row: NonNullable<Awaited<ReturnType<typeof prisma.booking.findFirst>>>;
    let invoiceSnapshot = null;

    if (isNewlyCompleting) {
      // Atomic: update booking + finalize finance in a single logical flow.
      // finalizeCompletedBooking runs its own $transaction; we update booking first
      // then pass it in. If finalize throws, we roll the booking back.
      row = await prisma.booking.update({
        where: { id: body.id },
        data: bookingData,
        include: bookingSelect(),
      });
      try {
        const groupName = bookingGroupNameFromNote(row.note);
        if (groupName) {
          const groupCandidates = await prisma.booking.findMany({
            where: {
              studioId: user.studioId,
              deletedAt: null,
              status: { not: "CANCELLED" },
            },
            include: bookingSelect(),
          });
          const groupRows = groupCandidates.filter((item) => bookingGroupNameFromNote(item.note) === groupName);
          invoiceSnapshot = await finalizeCompletedBookingGroup(groupRows.length ? groupRows : [row], user);
        } else {
          invoiceSnapshot = await finalizeCompletedBooking(row, user);
        }
      } catch (finalizeError) {
        // Roll back booking status to previous status so data stays consistent
        await prisma.booking.update({
          where: { id: body.id },
          data: { status: current.status },
        }).catch(() => null);
        throw finalizeError;
      }
    } else {
      row = await prisma.booking.update({
        where: { id: body.id },
        data: bookingData,
        include: bookingSelect(),
      });
    }

    await writeAuditLog(user, "UPDATE", "Booking", row.id, { customerName: row.customerName, name: row.packageName });
    return ok({ ...row, ...(invoiceSnapshot ?? {}) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    if (!canUpdate(user.role)) return fail("Bạn không có quyền sửa booking.", 403);

    const body = await req.json();
    if (body.action !== "reserveInvoiceCode") return fail("Hành động không hợp lệ.", 422);
    if (!body.id) return fail("Thiếu mã booking.", 422);

    const booking = await prisma.booking.findFirst({
      where: { id: String(body.id), studioId: user.studioId, deletedAt: null },
      include: bookingSelect(),
    });
    if (!booking) return fail("Không tìm thấy booking.", 404);

    const groupName = bookingGroupNameFromNote(booking.note);
    const invoiceCode = await prisma.$transaction(async (tx) => {
      if (groupName) {
        const groupRows = await tx.booking.findMany({
          where: {
            studioId: user.studioId,
            deletedAt: null,
            status: { not: "CANCELLED" },
          },
          select: { id: true, note: true },
        });
        const sameGroupRows = groupRows.filter((row) => bookingGroupNameFromNote(row.note) === groupName);
        const reservedCode = sameGroupRows.map((row) => reservedInvoiceCodeFromNote(row.note, "group")).find(Boolean);
        const code = reservedCode || await nextReservedAwareInvoiceCode(tx, user.studioId, true);
        await Promise.all(
          sameGroupRows.map((row) =>
            tx.booking.update({
              where: { id: row.id },
              data: { note: noteWithReservedInvoiceCode(row.note, code) },
            }),
          ),
        );
        return code;
      }

      const reservedCode = reservedInvoiceCodeFromNote(booking.note, "personal");
      const code = reservedCode || await nextReservedAwareInvoiceCode(tx, user.studioId, false);
      await tx.booking.update({
        where: { id: booking.id },
        data: { note: noteWithReservedInvoiceCode(booking.note, code) },
      });
      return code;
    });

    return ok({ invoiceCode, groupName });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return fail("Chỉ quản trị viên được xóa booking.", 403);

    const { id, mode } = await req.json();
    if (!id) return fail("Thiếu mã booking.", 422);

    if (mode === "hard") {
      const row = await prisma.booking.findFirst({ where: { id, studioId: user.studioId } });
      await prisma.booking.deleteMany({ where: { id, studioId: user.studioId } });
      await writeAuditLog(user, "DELETE", "Booking", String(id), { customerName: row?.customerName, name: row?.packageName });
    } else {
      const row = await prisma.booking.findFirst({ where: { id, studioId: user.studioId } });
      await prisma.booking.updateMany({
        where: { id, studioId: user.studioId },
        data: { deletedAt: new Date() },
      });
      await writeAuditLog(user, "TRASH", "Booking", String(id), { customerName: row?.customerName, name: row?.packageName });
    }

    return ok({ id });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
