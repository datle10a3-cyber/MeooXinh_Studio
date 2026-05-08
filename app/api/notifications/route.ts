import { fail, ok, serverError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { sendStudioPush } from "@/app/lib/push";

function money(value: unknown) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function bookingGroupLabel(note?: string | null) {
  const match = String(note ?? "").match(/Loại booking:\s*Booking nhóm(?:\s*-\s*([^\n.]+))?/i);
  return match ? (match[1]?.trim() || "Booking nhóm") : null;
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

function notificationType(type: string) {
  if (type === "BOOKING") return "booking";
  if (["PAYMENT", "DEBT"].includes(type)) return "invoice";
  return "notification";
}

const studioGenerationLock = new Map<string, number>();

export async function GET() {
  try {
    const user = await requireUser();
    const now = new Date();
    const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const inOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const [bookings, invoices, projects] = await Promise.all([
      prisma.booking.findMany({
        where: {
          studioId: user.studioId,
          deletedAt: null,
          status: { notIn: ["CANCELLED", "COMPLETED"] },
          startAt: { gte: now, lte: inOneDay },
        },
        orderBy: { startAt: "asc" },
        take: 8,
      }),
      prisma.invoice.findMany({
        where: {
          studioId: user.studioId,
          deletedAt: null,
          due: { gt: 0 },
          dueDate: { gte: now, lte: inThreeDays },
          status: { notIn: ["PAID", "VOID"] },
        },
        include: { customer: true },
        orderBy: { dueDate: "asc" },
        take: 6,
      }),
      prisma.project.findMany({
        where: {
          studioId: user.studioId,
          deletedAt: null,
          deadlineAt: { gte: now, lte: inThreeDays },
          status: { notIn: ["DELIVERED", "CANCELLED"] },
        },
        orderBy: { deadlineAt: "asc" },
        take: 6,
      }),
    ]);

    const bookingGroups = new Map<string, typeof bookings>();
    for (const booking of bookings) {
      const label = bookingGroupLabel(booking.note);
      const key = label
        ? `${bookingTimeKey(booking.startAt)}|${label}`
        : `single|${booking.id}`;
      bookingGroups.set(key, [...(bookingGroups.get(key) ?? []), booking]);
    }

    // Khóa chống lặp: Nếu studio vừa quét thông báo trong 10 giây qua thì không quét lại để tránh gửi trùng push
    const nowTime = Date.now();
    const lastCheck = studioGenerationLock.get(user.studioId) ?? 0;
    
    if (nowTime - lastCheck > 10000) {
      studioGenerationLock.set(user.studioId, nowTime);
      
      await Promise.all([
        ...Array.from(bookingGroups.values()).map(async (group) => {
          const booking = group[0];
          // Chỉ thông báo cho lịch tương lai
          if (booking.startAt <= now) return;

          const label = bookingGroupLabel(booking.note);
          const isGroup = group.length > 1 || Boolean(label);
          const nearNow = booking.startAt <= inTwoHours;
          const windowText = nearNow ? "trong 2 giờ tới" : "trong 24 giờ tới";
          const title = isGroup ? `Nhắc booking nhóm ${windowText}` : `Nhắc lịch chụp ${windowText}`;
          const customerText = isGroup
            ? `${label ?? "Booking nhóm"} có ${group.length} khách: ${group.map((item) => item.customerName || item.title).join(", ")}`
            : `Lịch ${booking.customerName || booking.title}`;
          const message = `${customerText} bắt đầu ${windowText}.${isGroup ? bookingPackageSummary(group) : ""}`;
          
          const existed = await prisma.notification.findFirst({
            where: {
              studioId: user.studioId,
              deletedAt: null,
              type: "BOOKING",
              title,
              message,
              dueAt: booking.startAt,
            },
            select: { id: true },
          });
          if (existed) return;
          const created = await prisma.notification.create({
            data: {
              studioId: user.studioId,
              userId: user.id,
              type: "BOOKING",
              title,
              message,
              dueAt: booking.startAt,
            },
          });
          await sendStudioPush(user.studioId, { title: created.title, body: created.message, url: "/booking", tag: created.id });
        }),
        ...invoices.map(async (invoice) => {
          if (!invoice.dueDate || invoice.dueDate <= now) return;

          const title = "Công nợ gần hạn";
          const message = `${invoice.customer?.name || "Khách hàng"} còn nợ ${money(invoice.due)}.`;
          const existed = await prisma.notification.findFirst({
            where: {
              studioId: user.studioId,
              deletedAt: null,
              type: "PAYMENT",
              title,
              message,
              dueAt: invoice.dueDate ?? undefined,
            },
            select: { id: true },
          });
          if (existed) return;
          const created = await prisma.notification.create({
            data: {
              studioId: user.studioId,
              userId: user.id,
              type: "PAYMENT",
              title,
              message,
              dueAt: invoice.dueDate,
            },
          });
          await sendStudioPush(user.studioId, { title: created.title, body: created.message, url: "/", tag: created.id });
        }),
        ...projects.map(async (project) => {
          if (!project.deadlineAt || project.deadlineAt <= now) return;

          const title = "Dự án sắp tới deadline";
          const message = `${project.name} cần được xử lý trước hạn.`;
          const existed = await prisma.notification.findFirst({
            where: {
              studioId: user.studioId,
              deletedAt: null,
              type: "SYSTEM",
              title,
              message,
              dueAt: project.deadlineAt ?? undefined,
            },
            select: { id: true },
          });
          if (existed) return;
          const created = await prisma.notification.create({
            data: {
              studioId: user.studioId,
              userId: user.id,
              type: "SYSTEM",
              title,
              message,
              dueAt: project.deadlineAt,
            },
          });
          await sendStudioPush(user.studioId, { title: created.title, body: created.message, url: "/", tag: created.id });
        }),
      ]);
    }

    const persistedNotifications = await prisma.notification.findMany({
      where: {
        studioId: user.studioId,
        deletedAt: null,
        // Chỉ hiện thông báo chưa tới hạn (hoặc thông báo hệ thống không có ngày hẹn)
        OR: [
          { dueAt: null },
          { dueAt: { gte: now } }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    const data = [
      ...persistedNotifications.map((notification) => ({
        id: `notification-${notification.id}`,
        sourceId: notification.type === "BOOKING"
          ? (bookings.find((booking) => notification.message.includes(booking.customerName || booking.title) && new Date(notification.dueAt ?? 0).getTime() === new Date(booking.startAt).getTime())?.id ?? notification.id)
          : notification.type === "PAYMENT"
            ? (invoices.find((invoice) => notification.message.includes(invoice.customer?.name || "Khách hàng"))?.id ?? notification.id)
            : notification.type === "SYSTEM"
              ? (projects.find((project) => notification.message.includes(project.name))?.id ?? notification.id)
              : notification.id,
        type: notificationType(notification.type),
        title: notification.title,
        message: notification.message,
        createdAt: notification.dueAt ?? notification.createdAt,
        isRead: notification.isRead,
        targetResource: notification.type === "BOOKING" ? "booking" : "notifications",
        targetPath: notification.type === "BOOKING" ? "/booking" : "/",
      })),
      ...([] as typeof bookings).map((booking) => ({
        id: `booking-${booking.id}`,
        sourceId: booking.id,
        type: "booking",
        title: "Sắp tới lịch chụp",
        message: `Lịch ${booking.customerName || booking.title} bắt đầu trong vòng 24 giờ tới.`,
        createdAt: booking.startAt,
        isRead: false,
        targetResource: "booking",
        targetPath: "/booking",
      })),
      ...invoices.map((invoice) => ({
        id: `invoice-${invoice.id}`,
        sourceId: invoice.id,
        type: "invoice",
        title: "Công nợ gần hạn",
        message: `${invoice.customer?.name || "Khách hàng"} còn nợ ${money(invoice.due)}.`,
        createdAt: invoice.dueDate ?? invoice.createdAt,
        isRead: false,
        targetResource: "invoices",
        targetPath: "/",
      })),
      ...projects.map((project) => ({
        id: `project-${project.id}`,
        sourceId: project.id,
        type: "project",
        title: "Dự án sắp tới deadline",
        message: `${project.name} cần được xử lý trước hạn.`,
        createdAt: project.deadlineAt ?? project.createdAt,
        isRead: false,
        targetResource: "projects",
        targetPath: "/",
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12);

    return ok(data);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { ids?: string[]; sourceIds?: string[] };
    const rawIds = [...(body.ids ?? []), ...(body.sourceIds ?? [])].filter((id): id is string => typeof id === "string");
    const ids = rawIds
      .map((id) => id.replace(/^notification-/, ""))
      .filter(Boolean);

    if (!ids.length) return ok({ count: 0 });

    const result = await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        studioId: user.studioId,
        deletedAt: null,
      },
      data: { isRead: true },
    });

    if (result.count > 0) await writeAuditLog(user, "READ", "Notification", undefined, { name: `${result.count} thông báo` });
    return ok({ count: result.count });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
