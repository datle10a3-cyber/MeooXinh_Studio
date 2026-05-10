import { created, fail, ok, serverError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { canCreate, canUpdate, requireUser, verifyStudioEditPassword } from "@/app/lib/auth";
import { finalizeCompletedBooking, finalizeGroupCompletedBookings } from "@/app/lib/finance-workflow";
import { prisma } from "@/app/lib/prisma";

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
    if (body.isGroupCheckout) {
      if (!(await verifyStudioEditPassword(user, body.studioPassword))) {
        return fail("Mật khẩu studio không đúng. Nhân viên cần nhập mật khẩu studio để sửa booking.", 401);
      }
      const shiftError = await ensureOpenPaymentShift(user.studioId);
      if (shiftError) return fail(shiftError, 409);

      const bookings = await prisma.booking.findMany({
        where: {
          id: { in: body.bookingIds },
          studioId: user.studioId,
          deletedAt: null,
        },
        include: bookingSelect(),
      });
      if (bookings.length === 0) return fail("Không tìm thấy các booking để thanh toán.", 404);

      const groupSnapshot = await finalizeGroupCompletedBookings(bookings, body.groupKey, body.groupTitle, user);
      await prisma.booking.updateMany({
        where: {
          id: { in: body.bookingIds },
          studioId: user.studioId,
        },
        data: {
          status: "COMPLETED",
        },
      });

      for (const b of bookings) {
        await writeAuditLog(user, "UPDATE", "Booking", b.id, { customerName: b.customerName, name: b.packageName });
      }

      return ok({ success: true, groupCheckout: true, ...(groupSnapshot ?? {}) });
    }

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
      note: body.discountType === undefined
        ? (body.note ? String(body.note).trim() : null)
        : appendBookingNote(body.note, discountInfo.label, bookingMode, body.groupLabel ? String(body.groupLabel) : undefined),
    };

    let row: any;
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
        invoiceSnapshot = await finalizeCompletedBooking(row, user);
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
