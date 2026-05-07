import { fail, serverError } from "@/app/lib/api-response";
import { requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type FindManyDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
};

const BATCH_SIZE = 1000;

function publicUser(row: Awaited<ReturnType<typeof prisma.user.findMany>>[number]) {
  const safe = { ...row } as Record<string, unknown>;
  delete safe.passwordHash;
  return safe;
}

async function findAllByCursor(delegate: FindManyDelegate, args: Record<string, unknown>) {
  const output: Array<Record<string, unknown>> = [];
  let cursor: string | null = null;
  while (true) {
    const rows = await delegate.findMany({
      ...args,
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    output.push(...rows);
    if (rows.length < BATCH_SIZE) break;
    cursor = String(rows[rows.length - 1]?.id ?? "");
    if (!cursor) break;
  }
  return output;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (user.role === "STAFF") return fail("Nhân viên không có quyền sao lưu dữ liệu.", 403);

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const fromDate = from ? new Date(`${from}T00:00:00`) : null;
    const toDate = to ? new Date(`${to}T23:59:59.999`) : null;
    const dateRange = fromDate || toDate ? { gte: fromDate ?? undefined, lte: toDate ?? undefined } : undefined;
    const dated = (field: string) => dateRange ? { [field]: dateRange } : {};
    const baseWhere = { studioId: user.studioId };
    const activeWhere = { studioId: user.studioId, deletedAt: null };

    const [
      studio,
      users,
      categories,
      packages,
      customers,
      bookings,
      projects,
      invoices,
      transactions,
      wallets,
      walletShifts,
      employees,
      equipment,
      notifications,
      media,
    ] = await Promise.all([
      prisma.studio.findUnique({ where: { id: user.studioId } }),
      prisma.user.findMany({ where: { studioId: user.studioId }, include: { role: true }, orderBy: { createdAt: "desc" } }),
      findAllByCursor(prisma.category as unknown as FindManyDelegate, { where: { ...baseWhere, ...dated("createdAt") }, orderBy: { createdAt: "desc" } }),
      findAllByCursor(prisma.package as unknown as FindManyDelegate, { where: { ...baseWhere, ...dated("createdAt") }, orderBy: { createdAt: "desc" } }),
      findAllByCursor(prisma.customer as unknown as FindManyDelegate, { where: { ...baseWhere, ...dated("createdAt") }, orderBy: { createdAt: "desc" } }),
      findAllByCursor(prisma.booking as unknown as FindManyDelegate, { where: { ...baseWhere, ...dated("startAt") }, orderBy: { createdAt: "desc" } }),
      findAllByCursor(prisma.project as unknown as FindManyDelegate, { where: { ...baseWhere, ...dated("createdAt") }, orderBy: { createdAt: "desc" } }),
      findAllByCursor(prisma.invoice as unknown as FindManyDelegate, { where: { ...baseWhere, ...dated("issueDate") }, include: { items: true, payments: true }, orderBy: { createdAt: "desc" } }),
      findAllByCursor(prisma.transaction as unknown as FindManyDelegate, { where: { ...baseWhere, ...dated("occurredAt") }, orderBy: { createdAt: "desc" } }),
      findAllByCursor(prisma.wallet as unknown as FindManyDelegate, { where: { ...baseWhere, ...dated("createdAt") }, orderBy: { createdAt: "desc" } }),
      findAllByCursor(prisma.walletShift as unknown as FindManyDelegate, { where: { ...baseWhere, ...dated("openedAt") }, orderBy: { openedAt: "desc" } }),
      findAllByCursor(prisma.employee as unknown as FindManyDelegate, { where: { ...baseWhere, ...dated("createdAt") }, orderBy: { createdAt: "desc" } }),
      findAllByCursor(prisma.equipment as unknown as FindManyDelegate, { where: { ...baseWhere, ...dated("createdAt") }, orderBy: { createdAt: "desc" } }),
      findAllByCursor(prisma.notification as unknown as FindManyDelegate, { where: { ...activeWhere, ...dated("createdAt") }, orderBy: { createdAt: "desc" } }),
      findAllByCursor(prisma.media as unknown as FindManyDelegate, { where: { ...baseWhere, ...dated("createdAt") }, orderBy: { createdAt: "desc" } }),
    ]);

    const backup = {
      version: 2,
      exportedAt: new Date().toISOString(),
      exportedBy: { id: user.id, name: user.name, email: user.email, role: user.role },
      range: { from: from ?? null, to: to ?? null },
      studio,
      data: {
        users: users.map(publicUser),
        categories,
        packages,
        customers,
        bookings,
        projects,
        invoices,
        transactions,
        wallets,
        walletShifts,
        employees,
        equipment,
        notifications,
        media,
      },
    };

    const rangeSuffix = from || to ? `-${from ?? "dau"}-${to ?? "nay"}` : "";
    const filename = `backup-meo-xinh${rangeSuffix}-${new Date().toISOString().slice(0, 10)}.json`;
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
