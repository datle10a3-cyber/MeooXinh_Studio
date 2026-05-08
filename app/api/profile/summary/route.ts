import { fail, ok, serverError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function readMetadata(metadata?: string | null) {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const session = await requireUser();
    const now = new Date();
    const monthStart = startOfMonth(now);
    const nextMonth = endOfMonth(now);

    const [user, studio, monthlyBookings, monthlyIncome, customerCount, auditLogs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.id },
        include: { role: true },
      }),
      prisma.studio.findUnique({
        where: { id: session.studioId },
        select: { id: true, name: true, slug: true, email: true, phone: true, address: true, currency: true },
      }),
      prisma.booking.count({
        where: {
          studioId: session.studioId,
          deletedAt: null,
          startAt: { gte: monthStart, lt: nextMonth },
        },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          studioId: session.studioId,
          deletedAt: null,
          type: "INCOME",
          occurredAt: { gte: monthStart, lt: nextMonth },
        },
      }),
      prisma.customer.count({
        where: { studioId: session.studioId, deletedAt: null },
      }),
      prisma.auditLog.findMany({
        where: { studioId: session.studioId },
        include: { user: { include: { role: true } } },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
    ]);

    return ok({
      user: user
        ? {
            id: user.id,
            studioId: user.studioId,
            role: user.role?.name ?? session.role,
            name: user.name,
            email: user.email,
            phone: user.phone,
            avatarUrl: user.avatarUrl,
            notificationsEnabled: (user as any).notificationsEnabled,
          }
        : session,
      studio,
      stats: {
        monthlyBookings,
        monthlyRevenue: Number(monthlyIncome._sum.amount ?? 0),
        customers: customerCount,
      },
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        metadata: readMetadata(log.metadata),
        actorName: log.user?.name ?? null,
        actorRole: log.user?.role?.name ?? null,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

function cleanText(value: unknown, max = 160) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

export async function PATCH(req: Request) {
  try {
    const session = await requireUser();
    const body = await req.json();
    const userInput = body?.user as Record<string, unknown> | undefined;
    const studioInput = body?.studio as Record<string, unknown> | undefined;

    const updates: Array<Promise<unknown>> = [];

    if (userInput) {
      const name = cleanText(userInput.name, 80);
      const email = cleanText(userInput.email, 120);
      const phone = cleanText(userInput.phone, 32);
      const notificationsEnabled = userInput.notificationsEnabled !== undefined 
        ? (userInput.notificationsEnabled === true || userInput.notificationsEnabled === "true")
        : undefined;

      const data: any = {};
      if (name !== undefined) {
        if (!name) return fail("Tên không được để trống.", 422);
        data.name = name;
      }
      if (email !== undefined) {
        if (!email) return fail("Email không được để trống.", 422);
        data.email = email;
      }
      if (phone !== undefined) data.phone = phone;
      if (notificationsEnabled !== undefined) data.notificationsEnabled = notificationsEnabled;

      if (Object.keys(data).length > 0) {
        updates.push(
          prisma.user.update({
            where: { id: session.id },
            data,
          }),
        );
      }
    }

    if (studioInput) {
      if (session.role === "STAFF") return fail("Nhân viên không có quyền sửa thông tin studio.", 403);
      const name = cleanText(studioInput.name, 120);
      const email = cleanText(studioInput.email, 120);
      const phone = cleanText(studioInput.phone, 32);
      const address = cleanText(studioInput.address, 240);
      if (!name) return fail("Tên studio không được để trống.", 422);

      updates.push(
        prisma.studio.update({
          where: { id: session.studioId },
          data: { name, email, phone, address },
        }),
      );
    }

    await Promise.all(updates);
    await writeAuditLog(session, "UPDATE", "profile", session.id);

    const [freshUser, studio] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.id }, include: { role: true } }),
      prisma.studio.findUnique({
        where: { id: session.studioId },
        select: { id: true, name: true, slug: true, email: true, phone: true, address: true, currency: true },
      }),
    ]);

    return ok({
      user: freshUser
        ? {
            id: freshUser.id,
            studioId: freshUser.studioId,
            role: freshUser.role?.name ?? session.role,
            name: freshUser.name,
            email: freshUser.email,
            phone: freshUser.phone,
            avatarUrl: freshUser.avatarUrl,
            notificationsEnabled: (freshUser as any).notificationsEnabled,
          }
        : session,
      studio,
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
