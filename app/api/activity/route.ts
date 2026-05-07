import { fail, ok, serverError } from "@/app/lib/api-response";
import { requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
}

function metadata(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const take = Math.min(Number(url.searchParams.get("take") ?? 80), 200);
    const cursor = url.searchParams.get("cursor");
    const entity = url.searchParams.get("entity");
    const action = url.searchParams.get("action");
    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"), true);

    const rows = await prisma.auditLog.findMany({
      where: {
        studioId: user.studioId,
        ...(entity ? { entity } : {}),
        ...(action ? { action } : {}),
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: { user: { include: { role: true } } },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > take;
    const items = (hasMore ? rows.slice(0, take) : rows).map((row) => ({
      id: row.id,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      metadata: metadata(row.metadata),
      actorName: row.user?.name ?? null,
      actorRole: row.user?.role?.name ?? null,
      createdAt: row.createdAt,
    }));

    return ok({ items, nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null, hasMore });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
