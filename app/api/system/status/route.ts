import { readdir, stat } from "fs/promises";
import path from "path";
import { fail, ok, serverError } from "@/app/lib/api-response";
import { requireUser } from "@/app/lib/auth";
import { productionSafetyIssues } from "@/app/lib/deploy-safety";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

type CountRow = { count: number | bigint | string };

function asNumber(value: unknown) {
  return Number(value ?? 0);
}

async function latestBackup() {
  const backupDir = path.join(process.cwd(), "backups");
  const files = await readdir(backupDir).catch(() => []);
  const backups = await Promise.all(
    files
      .filter((file) => /\.(dump|sql|json)$/i.test(file))
      .map(async (file) => {
        const filePath = path.join(backupDir, file);
        const info = await stat(filePath);
        return {
          name: file,
          size: info.size,
          createdAt: info.mtime.toISOString(),
        };
      }),
  );
  return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role === "STAFF") return fail("Nhân viên không có quyền xem sức khỏe hệ thống.", 403);

    const [tableRows, bookingCount, incomeCount, expenseCount, transactionCount, invoiceCount, customerCount, backup] = await Promise.all([
      prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::int AS count
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `,
      prisma.booking.count({ where: { studioId: user.studioId, deletedAt: null } }),
      prisma.transaction.count({ where: { studioId: user.studioId, deletedAt: null, type: "INCOME" } }),
      prisma.transaction.count({ where: { studioId: user.studioId, deletedAt: null, type: "EXPENSE" } }),
      prisma.transaction.count({ where: { studioId: user.studioId, deletedAt: null } }),
      prisma.invoice.count({ where: { studioId: user.studioId, deletedAt: null } }),
      prisma.customer.count({ where: { studioId: user.studioId, deletedAt: null } }),
      latestBackup(),
    ]);

    return ok({
      database: "Đang chạy",
      checkedAt: new Date().toISOString(),
      tableCount: asNumber(tableRows[0]?.count),
      counts: {
        bookings: bookingCount,
        income: incomeCount,
        expense: expenseCount,
        transactions: transactionCount,
        invoices: invoiceCount,
        customers: customerCount,
      },
      latestBackup: backup,
      productionSafety: {
        ok: productionSafetyIssues().length === 0,
        issues: productionSafetyIssues(),
      },
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
