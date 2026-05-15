import { prisma } from "@/app/lib/prisma";
import { sendStudioPush } from "@/app/lib/push";

function money(value: unknown) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function bookingGroupLabel(note?: string | null) {
  const match = String(note ?? "").match(/Loại booking:\s*Booking nhóm(?:\s*-\s*([^\n.]+))?/i);
  return match ? (match[1]?.trim() || "Booking nhóm") : null;
}

function bookingTimeLabel(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function bookingTimeKey(value: Date) {
  return value.toISOString();
}

function bookingPackageSummary(bookings: Array<{ packageName: string | null }>) {
  const packages = [...new Set(bookings.map((item) => item.packageName).filter((item): item is string => Boolean(item)))];
  if (!packages.length) return "";
  if (packages.length === 1) return ` Gói: ${packages[0]}.`;
  return ` Có ${packages.length} gói khác nhau: ${packages.slice(0, 4).join(", ")}${packages.length > 4 ? "..." : ""}.`;
}

async function createNotificationOnce(input: {
  studioId: string;
  userId?: string | null;
  type: string;
  title: string;
  message: string;
  dueAt: Date;
  url: string;
}) {
  const existed = await prisma.notification.findFirst({
    where: {
      studioId: input.studioId,
      deletedAt: null,
      type: input.type,
      dueAt: input.dueAt,
      message: input.message,
    },
    select: { id: true },
  });
  if (existed) return { created: false };

  const created = await prisma.notification.create({
    data: {
      studioId: input.studioId,
      userId: input.userId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      dueAt: input.dueAt,
    },
  });
  await sendStudioPush(input.studioId, { title: created.title, body: created.message, url: input.url, tag: created.id });
  return { created: true, id: created.id };
}

export async function generateStudioNotifications(studioId: string, userId?: string | null) {
  const now = new Date();
  const inOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [bookings, invoices, projects] = await Promise.all([
    prisma.booking.findMany({
      where: {
        studioId,
        deletedAt: null,
        status: { notIn: ["CANCELLED", "COMPLETED"] },
        startAt: { gt: now, lte: inOneDay },
      },
      orderBy: { startAt: "asc" },
      take: 20,
    }),
    prisma.invoice.findMany({
      where: {
        studioId,
        deletedAt: null,
        due: { gt: 0 },
        dueDate: { gt: now, lte: inThreeDays },
        status: { notIn: ["PAID", "VOID"] },
      },
      include: { customer: true },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.project.findMany({
      where: {
        studioId,
        deletedAt: null,
        deadlineAt: { gt: now, lte: inThreeDays },
        status: { notIn: ["DELIVERED", "CANCELLED"] },
      },
      orderBy: { deadlineAt: "asc" },
      take: 20,
    }),
  ]);

  const bookingGroups = new Map<string, typeof bookings>();
  for (const booking of bookings) {
    const label = bookingGroupLabel(booking.note);
    const key = label ? `${bookingTimeKey(booking.startAt)}|${label}` : `single|${booking.id}`;
    bookingGroups.set(key, [...(bookingGroups.get(key) ?? []), booking]);
  }

  let created = 0;
  for (const group of bookingGroups.values()) {
    const booking = group[0];
    const label = bookingGroupLabel(booking.note);
    const isGroup = group.length > 1 || Boolean(label);
    const customerText = isGroup
      ? `${label ?? "Booking nhóm"} có ${group.length} khách: ${group.map((item) => item.customerName || item.title).join(", ")}`
      : `Lịch ${booking.customerName || booking.title}`;
    const result = await createNotificationOnce({
      studioId,
      userId,
      type: "BOOKING",
      title: isGroup ? "Nhắc booking nhóm sắp tới" : "Nhắc lịch chụp sắp tới",
      message: `${customerText} bắt đầu lúc ${bookingTimeLabel(booking.startAt)}.${isGroup ? bookingPackageSummary(group) : ""}`,
      dueAt: booking.startAt,
      url: "/booking",
    });
    if (result.created) created += 1;
  }

  for (const invoice of invoices) {
    if (!invoice.dueDate) continue;
    const result = await createNotificationOnce({
      studioId,
      userId,
      type: "PAYMENT",
      title: "Công nợ gần hạn",
      message: `${invoice.customer?.name || "Khách hàng"} còn nợ ${money(invoice.due)}.`,
      dueAt: invoice.dueDate,
      url: "/",
    });
    if (result.created) created += 1;
  }

  for (const project of projects) {
    if (!project.deadlineAt) continue;
    const result = await createNotificationOnce({
      studioId,
      userId,
      type: "SYSTEM",
      title: "Dự án sắp tới deadline",
      message: `${project.name} cần được xử lý trước hạn.`,
      dueAt: project.deadlineAt,
      url: "/",
    });
    if (result.created) created += 1;
  }

  return { created };
}

export async function generateAllStudioNotifications() {
  const studios = await prisma.studio.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  let created = 0;
  for (const studio of studios) {
    const result = await generateStudioNotifications(studio.id, null);
    created += result.created;
  }
  return { studios: studios.length, created };
}
