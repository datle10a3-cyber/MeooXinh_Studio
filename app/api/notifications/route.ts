import { fail, ok, serverError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { requireUser } from "@/app/lib/auth";
import { generateStudioNotifications } from "@/app/lib/notification-service";
import { prisma } from "@/app/lib/prisma";

function notificationType(type: string) {
  if (type === "BOOKING") return "booking";
  if (["PAYMENT", "DEBT"].includes(type)) return "invoice";
  if (type === "SYSTEM") return "project";
  return "notification";
}

function targetForNotification(type: string) {
  if (type === "BOOKING") return { targetResource: "booking", targetPath: "/booking" };
  if (["PAYMENT", "DEBT"].includes(type)) return { targetResource: "invoices", targetPath: "/" };
  if (type === "SYSTEM") return { targetResource: "projects", targetPath: "/" };
  return { targetResource: "notifications", targetPath: "/" };
}

const studioGenerationLock = new Map<string, number>();

export async function GET() {
  try {
    const user = await requireUser();
    const now = new Date();
    const nowTime = Date.now();
    const lastCheck = studioGenerationLock.get(user.studioId) ?? 0;

    if (nowTime - lastCheck > 10000) {
      studioGenerationLock.set(user.studioId, nowTime);
      await generateStudioNotifications(user.studioId, user.id);
    }

    const persistedNotifications = await prisma.notification.findMany({
      where: {
        studioId: user.studioId,
        deletedAt: null,
        OR: [{ dueAt: null }, { dueAt: { gte: now } }],
      },
      orderBy: [{ isRead: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 12,
    });

    const data = persistedNotifications.map((notification) => ({
      id: `notification-${notification.id}`,
      sourceId: notification.id,
      type: notificationType(notification.type),
      title: notification.title,
      message: notification.message,
      createdAt: notification.dueAt ?? notification.createdAt,
      isRead: notification.isRead,
      ...targetForNotification(notification.type),
    }));

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
