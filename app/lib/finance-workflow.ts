import { Prisma } from "@prisma/client";
import { actorRoleLabel, auditActionLabel, auditEntityLabel } from "@/app/lib/audit";
import type { SessionUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type TransactionLike = {
  id?: string;
  studioId?: string | null;
  walletId?: string | null;
  walletShiftId?: string | null;
  customerId?: string | null;
  type?: string | null;
  amount?: Prisma.Decimal | number | string | null;
  approvalStatus?: string | null;
  deletedAt?: Date | string | null;
};

type BookingLike = {
  id: string;
  studioId: string;
  customerId?: string | null;
  customerName?: string | null;
  packageId?: string | null;
  packageName?: string | null;
  categoryName?: string | null;
  price: Prisma.Decimal;
  total: Prisma.Decimal;
  deposit: Prisma.Decimal;
  title: string;
  startAt: Date;
  endAt: Date;
  note?: string | null;
  imageUrl?: string | null;
  galleryUrls?: string | null;
  customer?: { avatarUrl?: string | null } | null;
  package?: { imageUrl?: string | null; galleryUrls?: string | null } | null;
};

function decimal(value: unknown) {
  return new Prisma.Decimal(String(value ?? 0));
}

function moneyNumber(value: unknown) {
  return Number(value ?? 0);
}

function transactionWalletDelta(transaction: TransactionLike) {
  if (!transaction.walletId || transaction.deletedAt || transaction.approvalStatus !== "APPROVED") return null;
  const amount = decimal(transaction.amount);
  if (amount.lte(0)) return null;
  if (transaction.type === "INCOME") return amount;
  if (transaction.type === "EXPENSE") return amount.neg();
  return null;
}

async function recalculateWalletShiftSnapshot(tx: Prisma.TransactionClient, studioId: string, shiftId?: string | null) {
  if (!shiftId) return;
  const shift = await tx.walletShift.findFirst({
    where: { id: shiftId, studioId },
    select: { id: true, openingBalance: true, actualClosingBalance: true },
  });
  if (!shift) return;

  const transactions = await tx.transaction.findMany({
    where: {
      studioId,
      walletShiftId: shift.id,
      deletedAt: null,
      approvalStatus: "APPROVED",
      type: { in: ["INCOME", "EXPENSE"] },
    },
    select: { type: true, amount: true },
  });

  const totalIncome = transactions
    .filter((item) => item.type === "INCOME")
    .reduce((sum, item) => sum.plus(decimal(item.amount)), new Prisma.Decimal(0));
  const totalExpense = transactions
    .filter((item) => item.type === "EXPENSE")
    .reduce((sum, item) => sum.plus(decimal(item.amount)), new Prisma.Decimal(0));
  const expectedClosingBalance = decimal(shift.openingBalance).plus(totalIncome).minus(totalExpense);
  const difference = shift.actualClosingBalance ? decimal(shift.actualClosingBalance).minus(expectedClosingBalance) : new Prisma.Decimal(0);

  await tx.walletShift.update({
    where: { id: shift.id },
    data: { totalIncome, totalExpense, expectedClosingBalance, difference },
  });
}

export async function applyTransactionWalletDelta(transaction: TransactionLike, direction: 1 | -1) {
  const delta = transactionWalletDelta(transaction);
  const walletId = transaction.walletId;
  const studioId = transaction.studioId;
  if (!delta || !walletId || !studioId) return;

  await prisma.$transaction(async (tx) => {
    await tx.wallet.updateMany({
      where: { id: walletId, studioId, deletedAt: null },
      data: { balance: { increment: direction === 1 ? delta : delta.neg() } },
    });
    await recalculateWalletShiftSnapshot(tx, studioId, transaction.walletShiftId);
  }, {
    maxWait: 15000,
    timeout: 30000,
  });
}

export async function replaceTransactionWalletDelta(before: TransactionLike | null, after: TransactionLike) {
  await prisma.$transaction(async (tx) => {
    const studioId = after.studioId ?? before?.studioId;
    if (!studioId) return;
    const beforeDelta = before ? transactionWalletDelta(before) : null;
    if (beforeDelta && before?.walletId) {
      await tx.wallet.updateMany({
        where: { id: before.walletId, studioId, deletedAt: null },
        data: { balance: { decrement: beforeDelta } },
      });
    }

    const afterDelta = transactionWalletDelta(after);
    if (afterDelta && after.walletId) {
      await tx.wallet.updateMany({
        where: { id: after.walletId, studioId, deletedAt: null },
        data: { balance: { increment: afterDelta } },
      });
    }

    const shiftIds = new Set([before?.walletShiftId, after.walletShiftId].filter(Boolean) as string[]);
    for (const shiftId of shiftIds) await recalculateWalletShiftSnapshot(tx, studioId, shiftId);
  }, {
    maxWait: 15000,
    timeout: 30000,
  });
}

export async function recalculateInvoiceDebt(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return null;

  const due = Prisma.Decimal.max(decimal(invoice.total).minus(decimal(invoice.paid)), new Prisma.Decimal(0));
  const status = due.lte(0) && decimal(invoice.total).gt(0) ? "PAID" : decimal(invoice.paid).gt(0) ? "PARTIALLY_PAID" : invoice.status;

  return prisma.invoice.update({
    where: { id: invoice.id },
    data: { due, status },
  });
}

async function defaultWallet(studioId: string) {
  return prisma.wallet.findFirst({
    where: { studioId, deletedAt: null, isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

async function activeOpenShiftWallet(studioId: string) {
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
    if (activeWalletWithShift) {
      const shiftId = openShifts.find((s) => s.walletId === activeWalletWithShift.id)?.id;
      return {
        wallet: activeWalletWithShift,
        openShift: shiftId ? { id: shiftId } : null,
      };
    }
  }
  const wallet = await defaultWallet(studioId);
  return {
    wallet,
    openShift: null,
  };
}

async function openShiftForWallet(tx: Prisma.TransactionClient, studioId: string, walletId?: string | null, occurredAt = new Date()) {
  if (!walletId) return null;
  return tx.walletShift.findFirst({
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

function bookingAmount(booking: BookingLike) {
  const total = decimal(booking.total);
  return total.gt(0) ? total : decimal(booking.price);
}

function bookingProjectCode(bookingId: string) {
  return `BOOKING-${bookingId.slice(-6).toUpperCase()}`;
}

function bookingInvoiceCode(bookingId: string) {
  return `INV-${bookingId.slice(-6).toUpperCase()}`;
}

function packageGalleryUrls(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 4) : [];
  } catch {
    return [];
  }
}

async function nextStudioInvoiceCode(tx: Prisma.TransactionClient, studioId: string) {
  const invoices = await tx.invoice.findMany({
    where: { studioId, code: { startsWith: "meoxinh" } },
    select: { code: true },
  });
  const max = invoices.reduce((highest, invoice) => {
    const match = /^meoxinh(\d+)$/i.exec(invoice.code);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `meoxinh${String(max + 1).padStart(2, "0")}`;
}

function receiptSnapshot(booking: BookingLike, invoiceCode: string) {
  const originalPrice = moneyNumber(booking.price);
  const finalPrice = moneyNumber(booking.total) > 0 ? moneyNumber(booking.total) : originalPrice;
  const discountAmount = Math.max(0, originalPrice - finalPrice);
  
  let discountLabel = "";
  let discountPercent = "";
  if (booking.note) {
    const match = /Giảm giá:\s*([^\n\r()]+)(?:\s*\((\d+%)\))?/.exec(booking.note);
    if (match) {
      discountLabel = match[1].trim();
      if (match[2]) {
        discountPercent = match[2];
      }
    }
  }

  if (!discountLabel && discountAmount > 0) {
    discountLabel = `${discountAmount.toLocaleString("vi-VN")} đ`;
  }

  return `RECEIPT:${JSON.stringify({
    invoiceCode,
    customerName: booking.customerName || "Khách hàng",
    packageName: booking.packageName || booking.title,
    categoryName: booking.categoryName || "STUDIO",
    originalPrice,
    discountLabel,
    discountPercent,
  })}`;
}

export async function finalizeCompletedBooking(booking: BookingLike, actor?: SessionUser) {
  const amount = bookingAmount(booking);
  if (amount.lte(0)) return null;

  const { wallet, openShift: resolvedOpenShift } = await activeOpenShiftWallet(booking.studioId);
  const marker = `BOOKING_DONE:${booking.id}`;
  const customerImage = booking.customerId ? booking.customer?.avatarUrl || null : booking.imageUrl || null;
  const packageImage = booking.package?.imageUrl || null;
  const proofGallery = JSON.stringify([packageImage, ...packageGalleryUrls(booking.package?.galleryUrls)].filter(Boolean).slice(0, 5));

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.upsert({
      where: { bookingId: booking.id },
      update: {
        customerId: booking.customerId ?? null,
        name: booking.title,
        coverUrl: customerImage,
        galleryUrls: proofGallery,
        amount,
        dueAmount: new Prisma.Decimal(0),
        status: "DELIVERED",
      },
      create: {
        studioId: booking.studioId,
        bookingId: booking.id,
        customerId: booking.customerId ?? null,
        code: bookingProjectCode(booking.id),
        name: booking.title,
        coverUrl: customerImage,
        galleryUrls: proofGallery,
        status: "DELIVERED",
        amount,
        dueAmount: new Prisma.Decimal(0),
        deadlineAt: booking.endAt,
        note: `Tự tạo từ booking hoàn tất ${booking.title}.`,
      },
    });

    const legacyCode = bookingInvoiceCode(booking.id);
    const existingInvoice = await tx.invoice.findFirst({
      where: {
        studioId: booking.studioId,
        deletedAt: null,
        OR: [{ projectId: project.id }, { code: legacyCode }],
      },
    });
    const invoiceCode = existingInvoice?.code && /^meoxinh\d+$/i.test(existingInvoice.code)
      ? existingInvoice.code
      : await nextStudioInvoiceCode(tx, booking.studioId);
    const snapshot = receiptSnapshot(booking, invoiceCode);
    const invoice = existingInvoice
      ? await tx.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          code: invoiceCode,
          customerId: booking.customerId ?? null,
          projectId: project.id,
          imageUrl: customerImage,
          galleryUrls: proofGallery,
          total: amount,
          paid: amount,
          due: new Prisma.Decimal(0),
          status: "PAID",
          note: `${snapshot}\nTự tạo từ booking hoàn tất ${booking.title}.`,
        },
      })
      : await tx.invoice.create({
        data: {
          studioId: booking.studioId,
          customerId: booking.customerId ?? null,
          projectId: project.id,
          code: invoiceCode,
          status: "PAID",
          imageUrl: customerImage,
          galleryUrls: proofGallery,
          issueDate: new Date(),
          total: amount,
          paid: amount,
          due: new Prisma.Decimal(0),
          note: `${snapshot}\nTự tạo từ booking hoàn tất ${booking.title}.`,
        },
      });

    await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
    const invoiceItem = await tx.invoiceItem.create({
      data: {
        invoiceId: invoice.id,
        description: booking.packageName || booking.title,
        quantity: 1,
        unitPrice: amount,
        total: amount,
      },
    });

    const existedIncome = await tx.transaction.findFirst({
      where: {
        studioId: booking.studioId,
        type: "INCOME",
        deletedAt: null,
        note: { contains: marker },
      },
      select: { id: true, walletId: true, walletShiftId: true, customerId: true, amount: true },
    });
    const occurredAt = new Date();
    const openShift = resolvedOpenShift ?? await openShiftForWallet(tx, booking.studioId, wallet?.id, occurredAt);
    const nextWalletShiftId = existedIncome?.walletShiftId ?? openShift?.id ?? null;

    if (existedIncome) {
      await tx.transaction.update({
        where: { id: existedIncome.id },
        data: {
          walletId: wallet?.id ?? existedIncome.walletId,
          walletShiftId: nextWalletShiftId,
          customerId: booking.customerId ?? null,
          projectId: project.id,
          title: booking.packageName || booking.title,
          imageUrl: customerImage,
          galleryUrls: proofGallery,
          amount,
          note: `${marker} | Hóa đơn: ${invoice.code} | ${snapshot} | Tự động cộng doanh thu khi booking hoàn tất.`,
        },
      });

      const previousAmount = decimal(existedIncome.amount);
      const previousWalletId = existedIncome.walletId;
      const nextWalletId = wallet?.id ?? previousWalletId;
      if (previousWalletId && previousWalletId === nextWalletId) {
        const diff = amount.minus(previousAmount);
        if (!diff.eq(0)) {
          await tx.wallet.updateMany({
            where: { id: previousWalletId, studioId: booking.studioId, deletedAt: null },
            data: { balance: { increment: diff } },
          });
        }
      } else {
        if (previousWalletId && previousAmount.gt(0)) {
          await tx.wallet.updateMany({
            where: { id: previousWalletId, studioId: booking.studioId, deletedAt: null },
            data: { balance: { decrement: previousAmount } },
          });
        }
        if (nextWalletId && amount.gt(0)) {
          await tx.wallet.updateMany({
            where: { id: nextWalletId, studioId: booking.studioId, deletedAt: null },
            data: { balance: { increment: amount } },
          });
        }
      }

      if (existedIncome.customerId && existedIncome.customerId !== booking.customerId) {
        await tx.customer.updateMany({
          where: { id: existedIncome.customerId, studioId: booking.studioId },
          data: { totalSpent: { decrement: previousAmount } },
        });
      }
      if (booking.customerId) {
        const customerDelta = existedIncome.customerId === booking.customerId ? amount.minus(previousAmount) : amount;
        if (!customerDelta.eq(0)) {
          await tx.customer.updateMany({
            where: { id: booking.customerId, studioId: booking.studioId },
            data: { totalSpent: { increment: customerDelta } },
          });
        }
      }

      const shiftIds = new Set([existedIncome.walletShiftId, nextWalletShiftId].filter(Boolean) as string[]);
      for (const shiftId of shiftIds) await recalculateWalletShiftSnapshot(tx, booking.studioId, shiftId);
    } else {
      await tx.transaction.create({
        data: {
          studioId: booking.studioId,
          walletId: wallet?.id,
          walletShiftId: openShift?.id,
          customerId: booking.customerId ?? null,
          projectId: project.id,
          type: "INCOME",
          title: booking.packageName || booking.title,
          imageUrl: customerImage,
          galleryUrls: proofGallery,
          amount,
          method: wallet?.type?.toUpperCase()?.includes("BANK") ? "BANK_TRANSFER" : "CASH",
          approvalStatus: "APPROVED",
          occurredAt: new Date(),
          note: `${marker} | Hóa đơn: ${invoice.code} | ${snapshot} | Tự động cộng doanh thu khi booking hoàn tất.`,
        },
      });

      if (wallet) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } },
        });
      }

      if (openShift?.id) await recalculateWalletShiftSnapshot(tx, booking.studioId, openShift.id);

      if (booking.customerId) {
        await tx.customer.updateMany({
          where: { id: booking.customerId, studioId: booking.studioId },
          data: { totalSpent: { increment: amount } },
        });
      }
    }

    // Verify actor userId exists in DB to avoid FK constraint violation
    const actorUserId = actor?.id
      ? (await tx.user.findUnique({ where: { id: actor.id }, select: { id: true } }))?.id ?? null
      : null;
    await tx.auditLog.create({
      data: {
        studioId: booking.studioId,
        userId: actorUserId,
        action: "FINALIZE_BOOKING",
        entity: "Booking",
        entityId: booking.id,
        metadata: JSON.stringify({
          actionLabel: auditActionLabel("FINALIZE_BOOKING"),
          entityLabel: auditEntityLabel("Booking"),
          actorName: actor?.name,
          actorRole: actor?.role,
          actorRoleLabel: actor ? actorRoleLabel(actor.role) : undefined,
          name: booking.packageName || booking.title,
          customerName: booking.customerName,
          amount: moneyNumber(amount),
          projectId: project.id,
          invoiceId: invoice.id,
          walletId: wallet?.id ?? null,
        }),
      },
    });

    return {
      invoiceCode: invoice.code,
      invoiceIssueDate: invoice.issueDate,
      invoiceCustomerName: booking.customerName || "Khách hàng",
      invoicePackageName: booking.packageName || booking.title,
      invoiceCategoryName: booking.categoryName || "STUDIO",
      invoiceTotal: amount.toString(),
      invoiceItems: [{
        description: invoiceItem.description,
        quantity: invoiceItem.quantity,
        total: invoiceItem.total.toString(),
      }],
    };
  }, {
    maxWait: 15000,
    timeout: 30000,
  });
}

function formatMoneyLocal(value: unknown) {
  const num = Number(value ?? 0);
  return num.toLocaleString("vi-VN") + " đ";
}

async function nextStudioGroupInvoiceCode(tx: Prisma.TransactionClient, studioId: string) {
  const invoices = await tx.invoice.findMany({
    where: { studioId, code: { startsWith: "GROUP-meoxinh" } },
    select: { code: true },
  });
  const max = invoices.reduce((highest, invoice) => {
    const match = /^GROUP-meoxinh(\d+)$/i.exec(invoice.code);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `GROUP-meoxinh${String(max + 1).padStart(2, "0")}`;
}

export async function finalizeGroupCompletedBookings(
  bookings: BookingLike[],
  groupKey: string,
  groupTitle: string,
  actor?: SessionUser
) {
  if (bookings.length === 0) return null;
  const firstBooking = bookings[0];
  const studioId = firstBooking.studioId;

  // Aggregate total amount of all bookings in the group
  const totalAmount = bookings.reduce((sum, b) => sum.add(decimal(b.total.gt(0) ? b.total : b.price)), decimal(0));
  if (totalAmount.lte(0)) return null;

  const { wallet, openShift: resolvedOpenShift } = await activeOpenShiftWallet(studioId);
  const occurredAt = new Date();

  // Group description / list of members
  const detailsList = bookings.map(b => `- ${b.customerName}: ${b.packageName} (${moneyNumber(b.total) > 0 ? formatMoneyLocal(b.total) : formatMoneyLocal(b.price)})`).join("\n");
  const projectNote = `Dự án nhóm gộp từ các booking:\n${detailsList}`;

  // Get first booking images
  const customerImage = firstBooking.customerId ? firstBooking.customer?.avatarUrl || null : firstBooking.imageUrl || null;
  const packageImage = firstBooking.package?.imageUrl || null;
  const proofGallery = JSON.stringify([packageImage, ...packageGalleryUrls(firstBooking.package?.galleryUrls)].filter(Boolean).slice(0, 5));

  return prisma.$transaction(async (tx) => {
    const openShift = resolvedOpenShift ?? await openShiftForWallet(tx, studioId, wallet?.id, occurredAt);

    // 1. Create one unified Project for the group
    const projectCode = `GRP-${groupKey.slice(0, 6).toUpperCase()}`;
    const project = await tx.project.upsert({
      where: { studioId_code: { studioId, code: projectCode } },
      update: {
        name: groupTitle,
        coverUrl: customerImage,
        galleryUrls: proofGallery,
        amount: totalAmount,
        dueAmount: new Prisma.Decimal(0),
        status: "DELIVERED",
        note: projectNote,
      },
      create: {
        studioId,
        code: projectCode,
        name: groupTitle,
        coverUrl: customerImage,
        galleryUrls: proofGallery,
        status: "DELIVERED",
        amount: totalAmount,
        dueAmount: new Prisma.Decimal(0),
        deadlineAt: firstBooking.endAt,
        note: projectNote,
      },
    });

    // 2. Create/Update group invoice: GROUP-meoxinh01, etc.
    const existingInvoice = await tx.invoice.findFirst({
      where: {
        studioId,
        deletedAt: null,
        projectId: project.id,
      },
    });

    const invoiceCode = existingInvoice?.code && /^GROUP-meoxinh\d+$/i.test(existingInvoice.code)
      ? existingInvoice.code
      : await nextStudioGroupInvoiceCode(tx, studioId);

    // Snapshot structure to represent group elements
    const snapshotObj = {
      invoiceCode,
      customerName: groupTitle,
      packageName: `Thanh toán nhóm (${bookings.length} khách)`,
      categoryName: "STUDIO",
      originalPrice: bookings.reduce((sum, b) => sum + moneyNumber(b.price), 0),
      discountLabel: formatMoneyLocal(bookings.reduce((sum, b) => sum + (moneyNumber(b.price) - (moneyNumber(b.total) > 0 ? moneyNumber(b.total) : moneyNumber(b.price))), 0)),
      discountPercent: "",
      isGroupInvoice: true,
      groupRows: bookings.map(b => ({
        customerName: b.customerName,
        packageName: b.packageName,
        price: moneyNumber(b.price),
        total: moneyNumber(b.total) > 0 ? moneyNumber(b.total) : moneyNumber(b.price),
      })),
    };
    const snapshot = `RECEIPT:${JSON.stringify(snapshotObj)}`;

    const invoice = existingInvoice
      ? await tx.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          code: invoiceCode,
          projectId: project.id,
          imageUrl: customerImage,
          galleryUrls: proofGallery,
          total: totalAmount,
          paid: totalAmount,
          due: new Prisma.Decimal(0),
          status: "PAID",
          note: `${snapshot}\n${projectNote}`,
        },
      })
      : await tx.invoice.create({
        data: {
          studioId,
          projectId: project.id,
          code: invoiceCode,
          status: "PAID",
          imageUrl: customerImage,
          galleryUrls: proofGallery,
          issueDate: new Date(),
          total: totalAmount,
          paid: totalAmount,
          due: new Prisma.Decimal(0),
          note: `${snapshot}\n${projectNote}`,
        },
      });

    // 3. Create invoice items for each booking inside the group!
    await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
    for (const b of bookings) {
      const rowPrice = moneyNumber(b.total) > 0 ? moneyNumber(b.total) : moneyNumber(b.price);
      await tx.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          description: `${b.customerName} - ${b.packageName}`,
          quantity: 1,
          unitPrice: new Prisma.Decimal(rowPrice),
          total: new Prisma.Decimal(rowPrice),
        },
      });
    }

    // 4. Log one consolidated income Transaction into the open wallet shift!
    const transactionTitle = `Thanh toán nhóm: ${groupTitle}`;
    await tx.transaction.deleteMany({
      where: {
        studioId,
        walletShiftId: openShift?.id,
        note: { startsWith: `GROUP_CHECKOUT:${groupKey}` },
      },
    });

    await tx.transaction.create({
      data: {
        studioId,
        walletId: wallet?.id,
        walletShiftId: openShift?.id,
        projectId: project.id,
        type: "INCOME",
        title: transactionTitle,
        amount: totalAmount,
        method: wallet?.type?.toUpperCase()?.includes("BANK") ? "BANK_TRANSFER" : "CASH",
        approvalStatus: "APPROVED",
        note: `${snapshot}\nGROUP_CHECKOUT:${groupKey}\nThao tác bởi: ${actor?.name || "Hệ thống"}.\n${projectNote}`,
      },
    });

    // Apply wallet delta
    if (wallet) {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: totalAmount } },
      });
    }

    if (openShift?.id) await recalculateWalletShiftSnapshot(tx, studioId, openShift.id);

    return {
      invoiceCode,
      invoiceId: invoice.id,
    };
  }, {
    maxWait: 15000,
    timeout: 30000,
  });
}

