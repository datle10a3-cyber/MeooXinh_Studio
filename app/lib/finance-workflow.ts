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
  customer?: { name?: string | null; avatarUrl?: string | null } | null;
  package?: { imageUrl?: string | null; galleryUrls?: string | null } | null;
};

type GroupBookingCustomerSnapshot = {
  id: string;
  customerDbId?: string | null;
  customerName: string;
  customerImage?: string | null;
  packageName: string;
  packageImage?: string | null;
  packageImages: string[];
  status: string;
  subtotal: number;
  extraFee: number;
  totalAmount: number;
  invoiceCode: string;
};

type GroupBookingSnapshot = {
  id: string;
  groupName: string;
  paymentInfo: {
    invoiceCode: string;
    walletId?: string | null;
    walletName?: string | null;
    walletShiftId?: string | null;
    paymentMethod: string;
    paidAt: string;
  };
  subtotal: number;
  discount: number;
  extraFee: number;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
  customers: GroupBookingCustomerSnapshot[];
};

function groupBookingName(note?: string | null) {
  const text = String(note ?? "");
  const direct = text.match(/Loáº¡i booking:\s*Booking nhĂ³m(?:\s*-\s*([^\n.]+))?/i);
  if (direct) return direct[1]?.trim() || "Booking nhĂ³m";
  const fallback = text.match(/Booking\s+nh\S*m(?:\s*-\s*([^\n.]+))?/i);
  return fallback ? fallback[1]?.trim() || "Booking nhĂ³m" : null;
}

function groupBookingKey(groupName: string) {
  return groupName.trim().toLowerCase();
}

function groupBookingMarker(groupName: string) {
  return `GROUP_BOOKING_DONE:${groupBookingKey(groupName)}`;
}

function groupBookingLine(snapshot: GroupBookingSnapshot) {
  return `GROUP_BOOKING:${JSON.stringify(snapshot)}`;
}

function withGroupBookingLine(note: string | null | undefined, snapshot: GroupBookingSnapshot) {
  const source = String(note ?? "").trim();
  const nextLine = groupBookingLine(snapshot);
  if (/^GROUP_BOOKING:.+$/m.test(source)) return source.replace(/^GROUP_BOOKING:.+$/m, nextLine);
  return [source, nextLine].filter(Boolean).join("\n");
}

function groupBookingSnapshotFromNote(note?: string | null) {
  const match = String(note ?? "").match(/^GROUP_BOOKING:(.+)$/m);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return parsed && typeof parsed === "object" ? parsed as GroupBookingSnapshot : null;
  } catch {
    return null;
  }
}

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

function bookingDoneIdFromNote(note?: string | null) {
  return /BOOKING_DONE:([^\s|]+)/.exec(String(note ?? ""))?.[1] ?? null;
}

function replaceReceiptSnapshot(note: string | null | undefined, snapshot: string) {
  const source = String(note ?? "").trim();
  if (/RECEIPT:\{.*?\}(?=\s*\||\n|$)/.test(source)) {
    return source.replace(/RECEIPT:\{.*?\}(?=\s*\||\n|$)/, snapshot);
  }
  return [snapshot, source].filter(Boolean).join(" | ");
}

export async function syncLinkedFinanceFromTransaction(transactionId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      customer: true,
      project: { include: { booking: true } },
    },
  });
  if (!transaction || transaction.deletedAt || transaction.type !== "INCOME") return null;

  const bookingId = bookingDoneIdFromNote(transaction.note) ?? transaction.project?.bookingId ?? null;
  if (!bookingId) return null;

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, studioId: transaction.studioId, deletedAt: null },
    include: { customer: true },
  });
  if (!booking) return null;

  const packageName = String(transaction.title || booking.packageName || booking.title).trim();
  const customerName = booking.customer?.name || booking.customerName || transaction.customer?.name || "Khách hàng";
  const amount = decimal(transaction.amount);
  const galleryUrls = transaction.galleryUrls ?? booking.galleryUrls ?? null;
  const imageUrl = transaction.imageUrl ?? booking.imageUrl ?? null;

  return prisma.$transaction(async (tx) => {
    const project = transaction.projectId
      ? await tx.project.findFirst({ where: { id: transaction.projectId, studioId: transaction.studioId, deletedAt: null } })
      : await tx.project.findFirst({ where: { bookingId: booking.id, studioId: transaction.studioId, deletedAt: null } });

    let invoice = project
      ? await tx.invoice.findFirst({ where: { projectId: project.id, studioId: transaction.studioId, deletedAt: null }, orderBy: { createdAt: "desc" } })
      : null;
    if (!invoice) {
      invoice = await tx.invoice.findFirst({
        where: {
          studioId: transaction.studioId,
          deletedAt: null,
          note: { contains: `BOOKING_DONE:${booking.id}` },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        customerId: transaction.customerId ?? booking.customerId,
        customerName,
        packageName,
        title: `${customerName} - ${packageName}`,
        imageUrl,
        galleryUrls,
        total: amount,
      },
    });

    if (project) {
      await tx.project.update({
        where: { id: project.id },
        data: {
          customerId: transaction.customerId ?? project.customerId,
          name: `${customerName} - ${packageName}`,
          coverUrl: imageUrl,
          galleryUrls,
          amount,
          dueAmount: new Prisma.Decimal(0),
        },
      });
    }

    if (invoice) {
      const snapshot = receiptSnapshot({
        id: booking.id,
        studioId: booking.studioId,
        customerId: transaction.customerId ?? booking.customerId,
        customerName,
        packageId: booking.packageId,
        packageName,
        categoryName: booking.categoryName,
        price: amount,
        total: amount,
        deposit: booking.deposit,
        title: `${customerName} - ${packageName}`,
        startAt: booking.startAt,
        endAt: booking.endAt,
        note: booking.note,
        imageUrl,
        galleryUrls,
      }, invoice.code);
      const syncedNote = replaceReceiptSnapshot(transaction.note, snapshot);

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          customerId: transaction.customerId ?? invoice.customerId,
          projectId: project?.id ?? invoice.projectId,
          imageUrl,
          galleryUrls,
          subtotal: amount,
          discount: new Prisma.Decimal(0),
          total: amount,
          paid: amount,
          due: new Prisma.Decimal(0),
          status: "PAID",
          note: replaceReceiptSnapshot(invoice.note, snapshot),
        },
      });
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          projectId: project?.id ?? transaction.projectId,
          customerId: transaction.customerId ?? booking.customerId,
          note: syncedNote,
        },
      });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
      await tx.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          description: packageName,
          quantity: 1,
          unitPrice: amount,
          total: amount,
        },
      });
    }

    if (booking.customerId && booking.customerId !== transaction.customerId) {
      await tx.customer.updateMany({
        where: { id: booking.customerId, studioId: transaction.studioId },
        data: { totalSpent: { decrement: decimal(booking.total) } },
      });
    }
    if (transaction.customerId) {
      const previousAmount = booking.customerId === transaction.customerId ? decimal(booking.total) : new Prisma.Decimal(0);
      const diff = amount.minus(previousAmount);
      if (!diff.eq(0)) {
        await tx.customer.updateMany({
          where: { id: transaction.customerId, studioId: transaction.studioId },
          data: { totalSpent: { increment: diff } },
        });
      }
    }

    return { bookingId: booking.id, projectId: project?.id ?? null, invoiceId: invoice?.id ?? null };
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

const RESERVED_INVOICE_MARKER = "INVOICE_RESERVED:";

export function reservedInvoiceCodeFromNote(note?: string | null, mode: "personal" | "group" = "personal") {
  const match = new RegExp(`${RESERVED_INVOICE_MARKER}(Group-meoxinh\\d+|meoxinh\\d+)`, "i").exec(String(note ?? ""));
  const code = match?.[1] ?? "";
  if (mode === "group") return /^Group-meoxinh\d+$/i.test(code) ? code : "";
  return /^meoxinh\d+$/i.test(code) ? code : "";
}

export function noteWithReservedInvoiceCode(note: unknown, code: string) {
  const cleaned = String(note ?? "")
    .replace(new RegExp(`\\n?${RESERVED_INVOICE_MARKER}(?:Group-meoxinh\\d+|meoxinh\\d+)`, "gi"), "")
    .trim();
  return [cleaned, `${RESERVED_INVOICE_MARKER}${code}`].filter(Boolean).join("\n");
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

export async function nextStudioInvoiceCode(tx: Prisma.TransactionClient, studioId: string) {
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

export async function nextGroupInvoiceCode(tx: Prisma.TransactionClient, studioId: string) {
  const invoices = await tx.invoice.findMany({
    where: { studioId, deletedAt: null, code: { startsWith: "Group-meoxinh" } },
    select: { code: true },
  });
  const max = invoices.reduce((highest, invoice) => {
    const match = /^Group-meoxinh(\d+)$/i.exec(invoice.code);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `Group-meoxinh${String(max + 1).padStart(2, "0")}`;
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

export function bookingGroupNameFromNote(note?: string | null) {
  return groupBookingName(note);
}

export async function finalizeCompletedBookingGroup(bookings: BookingLike[], actor?: SessionUser) {
  const activeBookings = bookings.filter((booking) => booking.studioId && booking.id);
  if (!activeBookings.length) return null;

  const firstBooking = activeBookings[0];
  const groupName = activeBookings.map((booking) => groupBookingName(booking.note)).find(Boolean) ?? "Booking nhĂ³m";
  const marker = groupBookingMarker(groupName);
  const sortedBookings = [...activeBookings].sort((a, b) => {
    const timeDiff = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return String(a.customerName ?? a.id).localeCompare(String(b.customerName ?? b.id), "vi");
  });
  const subtotal = sortedBookings.reduce((sum, booking) => sum.plus(decimal(booking.price)), new Prisma.Decimal(0));
  const amount = sortedBookings.reduce((sum, booking) => sum.plus(bookingAmount(booking)), new Prisma.Decimal(0));
  if (amount.lte(0)) return null;

  const { wallet, openShift: resolvedOpenShift } = await activeOpenShiftWallet(firstBooking.studioId);
  const paymentMethod = wallet?.type?.toUpperCase()?.includes("BANK") ? "BANK_TRANSFER" : "CASH";
  const occurredAt = new Date();

  return prisma.$transaction(async (tx) => {
    const existingInvoice = await tx.invoice.findFirst({
      where: {
        studioId: firstBooking.studioId,
        deletedAt: null,
        note: { contains: marker },
      },
    });
    const reservedInvoiceCode = sortedBookings.map((booking) => reservedInvoiceCodeFromNote(booking.note, "group")).find(Boolean);
    const reservedInvoice = reservedInvoiceCode
      ? await tx.invoice.findFirst({ where: { studioId: firstBooking.studioId, deletedAt: null, code: reservedInvoiceCode }, select: { id: true } })
      : null;
    const invoiceCode = existingInvoice?.code && /^Group-meoxinh\d+$/i.test(existingInvoice.code)
      ? existingInvoice.code
      : reservedInvoiceCode && (!reservedInvoice || reservedInvoice.id === existingInvoice?.id)
        ? reservedInvoiceCode
      : await nextGroupInvoiceCode(tx, firstBooking.studioId);
    const openShift = resolvedOpenShift ?? await openShiftForWallet(tx, firstBooking.studioId, wallet?.id, occurredAt);
    const galleryImages = sortedBookings
      .flatMap((booking) => [booking.package?.imageUrl, ...packageGalleryUrls(booking.package?.galleryUrls)])
      .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      .slice(0, 8);
    const customers: GroupBookingCustomerSnapshot[] = sortedBookings.map((booking) => {
      const packageImages = [booking.package?.imageUrl, ...packageGalleryUrls(booking.package?.galleryUrls)]
        .filter((item): item is string => typeof item === "string" && Boolean(item?.trim()))
        .slice(0, 8);
      return {
        id: booking.id,
        customerDbId: booking.customerId ?? null,
        customerName: booking.customerName || booking.customer?.name || "KhĂ¡ch hĂ ng",
        customerImage: booking.customer?.avatarUrl || booking.imageUrl || null,
        packageName: booking.packageName || booking.title,
        packageImage: packageImages[0] ?? null,
        packageImages,
        status: "COMPLETED",
        subtotal: moneyNumber(booking.price),
        extraFee: 0,
        totalAmount: moneyNumber(bookingAmount(booking)),
        invoiceCode,
      };
    });
    const snapshot: GroupBookingSnapshot = {
      id: marker,
      groupName,
      paymentInfo: {
        invoiceCode,
        walletId: wallet?.id ?? null,
        walletName: wallet?.name ?? null,
        walletShiftId: openShift?.id ?? null,
        paymentMethod,
        paidAt: occurredAt.toISOString(),
      },
      subtotal: moneyNumber(subtotal),
      discount: Math.max(0, moneyNumber(subtotal.minus(amount))),
      extraFee: 0,
      totalAmount: moneyNumber(amount),
      paymentMethod,
      createdAt: occurredAt.toISOString(),
      customers,
    };
    const sourceLine = groupBookingLine(snapshot);
    const note = `${marker}\n${sourceLine}\nTá»± Ä‘á»™ng cá»™ng doanh thu khi booking nhĂ³m hoĂ n táº¥t.`;

    const existingProject = await tx.project.findFirst({
      where: {
        studioId: firstBooking.studioId,
        deletedAt: null,
        OR: [
          { bookingId: firstBooking.id },
          { note: { contains: marker } },
        ],
      },
    });
    const projectData = {
      customerId: null,
      name: groupName,
      coverUrl: galleryImages[0] ?? null,
      galleryUrls: JSON.stringify(galleryImages),
      amount,
      dueAmount: new Prisma.Decimal(0),
      status: "DELIVERED",
      deadlineAt: sortedBookings.at(-1)?.endAt ?? firstBooking.endAt,
      note,
    };
    const project = existingProject
      ? await tx.project.update({ where: { id: existingProject.id }, data: projectData })
      : await tx.project.create({
        data: {
          studioId: firstBooking.studioId,
          bookingId: firstBooking.id,
          code: `GROUP-${firstBooking.id.slice(-6).toUpperCase()}`,
          ...projectData,
        },
      });

    const invoice = existingInvoice
      ? await tx.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          code: invoiceCode,
          customerId: null,
          projectId: project.id,
          imageUrl: galleryImages[0] ?? null,
          galleryUrls: JSON.stringify(galleryImages),
          subtotal,
          discount: subtotal.minus(amount).gt(0) ? subtotal.minus(amount) : new Prisma.Decimal(0),
          total: amount,
          paid: amount,
          due: new Prisma.Decimal(0),
          status: "PAID",
          note,
        },
      })
      : await tx.invoice.create({
        data: {
          studioId: firstBooking.studioId,
          customerId: null,
          projectId: project.id,
          code: invoiceCode,
          status: "PAID",
          imageUrl: galleryImages[0] ?? null,
          galleryUrls: JSON.stringify(galleryImages),
          issueDate: occurredAt,
          subtotal,
          discount: subtotal.minus(amount).gt(0) ? subtotal.minus(amount) : new Prisma.Decimal(0),
          total: amount,
          paid: amount,
          due: new Prisma.Decimal(0),
          note,
        },
      });

    await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
    await tx.invoiceItem.createMany({
      data: customers.map((customer) => ({
        invoiceId: invoice.id,
        description: `${customer.customerName} - ${customer.packageName}`,
        quantity: 1,
        unitPrice: new Prisma.Decimal(customer.totalAmount),
        total: new Prisma.Decimal(customer.totalAmount),
      })),
    });

    const existedIncome = await tx.transaction.findFirst({
      where: {
        studioId: firstBooking.studioId,
        type: "INCOME",
        deletedAt: null,
        note: { contains: marker },
      },
      select: { id: true, walletId: true, walletShiftId: true, amount: true, note: true },
    });
    const nextWalletShiftId = existedIncome?.walletShiftId ?? openShift?.id ?? null;
    const transactionData = {
      walletId: wallet?.id ?? existedIncome?.walletId ?? null,
      walletShiftId: nextWalletShiftId,
      customerId: null,
      projectId: project.id,
      title: groupName,
      imageUrl: galleryImages[0] ?? null,
      galleryUrls: JSON.stringify(galleryImages),
      amount,
      method: paymentMethod,
      approvalStatus: "APPROVED",
      occurredAt,
      note,
    };

    if (existedIncome) {
      await tx.transaction.update({ where: { id: existedIncome.id }, data: transactionData });
      const previousAmount = decimal(existedIncome.amount);
      const previousWalletId = existedIncome.walletId;
      const nextWalletId = transactionData.walletId;
      if (previousWalletId && previousWalletId === nextWalletId) {
        const diff = amount.minus(previousAmount);
        if (!diff.eq(0)) {
          await tx.wallet.updateMany({
            where: { id: previousWalletId, studioId: firstBooking.studioId, deletedAt: null },
            data: { balance: { increment: diff } },
          });
        }
      } else {
        if (previousWalletId && previousAmount.gt(0)) {
          await tx.wallet.updateMany({
            where: { id: previousWalletId, studioId: firstBooking.studioId, deletedAt: null },
            data: { balance: { decrement: previousAmount } },
          });
        }
        if (nextWalletId && amount.gt(0)) {
          await tx.wallet.updateMany({
            where: { id: nextWalletId, studioId: firstBooking.studioId, deletedAt: null },
            data: { balance: { increment: amount } },
          });
        }
      }

      const oldSnapshot = groupBookingSnapshotFromNote(existedIncome.note);
      for (const oldCustomer of oldSnapshot?.customers ?? []) {
        if (!oldCustomer.customerDbId || oldCustomer.totalAmount <= 0) continue;
        await tx.customer.updateMany({
          where: { id: oldCustomer.customerDbId, studioId: firstBooking.studioId },
          data: { totalSpent: { decrement: new Prisma.Decimal(oldCustomer.totalAmount) } },
        });
      }
    } else {
      await tx.transaction.create({
        data: {
          studioId: firstBooking.studioId,
          type: "INCOME",
          ...transactionData,
        },
      });
      if (wallet) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } },
        });
      }
    }

    for (const customer of customers) {
      if (!customer.customerDbId || customer.totalAmount <= 0) continue;
      await tx.customer.updateMany({
        where: { id: customer.customerDbId, studioId: firstBooking.studioId },
        data: { totalSpent: { increment: new Prisma.Decimal(customer.totalAmount) } },
      });
    }

    const shiftIds = new Set([existedIncome?.walletShiftId, nextWalletShiftId].filter(Boolean) as string[]);
    for (const shiftId of shiftIds) await recalculateWalletShiftSnapshot(tx, firstBooking.studioId, shiftId);

    for (const booking of sortedBookings) {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "COMPLETED",
          note: withGroupBookingLine(booking.note, snapshot),
        },
      });
    }

    const actorUserId = actor?.id
      ? (await tx.user.findUnique({ where: { id: actor.id }, select: { id: true } }))?.id ?? null
      : null;
    await tx.auditLog.create({
      data: {
        studioId: firstBooking.studioId,
        userId: actorUserId,
        action: "FINALIZE_GROUP_BOOKING",
        entity: "Booking",
        entityId: firstBooking.id,
        metadata: JSON.stringify({
          actionLabel: "HoĂ n táº¥t booking nhĂ³m",
          entityLabel: auditEntityLabel("Booking"),
          actorName: actor?.name,
          actorRole: actor?.role,
          actorRoleLabel: actor ? actorRoleLabel(actor.role) : undefined,
          groupName,
          customerCount: customers.length,
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
      invoiceCustomerName: groupName,
      invoicePackageName: groupName,
      invoiceCategoryName: "BOOKING_GROUP",
      invoiceTotal: amount.toString(),
      invoiceItems: customers.map((customer) => ({
        description: `${customer.customerName} - ${customer.packageName}`,
        quantity: 1,
        total: String(customer.totalAmount),
      })),
      groupBooking: snapshot,
    };
  }, {
    maxWait: 15000,
    timeout: 30000,
  });
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
    const reservedInvoiceCode = reservedInvoiceCodeFromNote(booking.note, "personal");
    const reservedInvoice = reservedInvoiceCode
      ? await tx.invoice.findFirst({ where: { studioId: booking.studioId, deletedAt: null, code: reservedInvoiceCode }, select: { id: true } })
      : null;
    const invoiceCode = existingInvoice?.code && /^meoxinh\d+$/i.test(existingInvoice.code)
      ? existingInvoice.code
      : reservedInvoiceCode && (!reservedInvoice || reservedInvoice.id === existingInvoice?.id)
        ? reservedInvoiceCode
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
