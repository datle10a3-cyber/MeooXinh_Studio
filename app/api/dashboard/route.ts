import { fail, ok, serverError } from "@/app/lib/api-response";
import { requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type ChartMode = "day" | "month" | "year";
type RevenuePoint = { label: string; income: number; expense: number; profit: number };
type ChartTransaction = { amount: unknown; type: string; occurredAt: Date };

const MIN_DASHBOARD_YEAR = 2025;
const MAX_DASHBOARD_YEAR = 2050;

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function parseChartMode(value: string | null): ChartMode {
  if (value === "day" || value === "year") return value;
  return "month";
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dayKey(date: Date) {
  return `${monthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

function yearKey(date: Date) {
  return String(date.getFullYear());
}

function clampNumber(value: string | null, fallback: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

function getChartRange(mode: ChartMode, date: Date, fromYear?: number, toYear?: number) {
  if (mode === "day") {
    return {
      start: new Date(date.getFullYear(), date.getMonth(), 1),
      end: new Date(date.getFullYear(), date.getMonth() + 1, 1),
    };
  }

  if (mode === "month") {
    return {
      start: new Date(date.getFullYear(), 0, 1),
      end: new Date(date.getFullYear() + 1, 0, 1),
    };
  }

  if (fromYear && toYear) {
    return {
      start: new Date(fromYear, 0, 1),
      end: new Date(toYear + 1, 0, 1),
    };
  }

  return null;
}

function applyTransaction(row: RevenuePoint, item: ChartTransaction) {
  if (item.type === "INCOME") row.income += toNumber(item.amount);
  if (item.type === "EXPENSE") row.expense += toNumber(item.amount);
  row.profit = row.income - row.expense;
}

function buildDayRevenue(transactions: ChartTransaction[], date: Date) {
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const rows = new Map<string, RevenuePoint>();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const rowDate = new Date(date.getFullYear(), date.getMonth(), day);
    rows.set(dayKey(rowDate), { label: String(day), income: 0, expense: 0, profit: 0 });
  }

  for (const item of transactions) {
    const row = rows.get(dayKey(item.occurredAt));
    if (row) applyTransaction(row, item);
  }

  return Array.from(rows.values());
}

function buildMonthRevenue(transactions: ChartTransaction[], date: Date) {
  const rows = new Map<string, RevenuePoint>();

  for (let month = 0; month < 12; month += 1) {
    const rowDate = new Date(date.getFullYear(), month, 1);
    rows.set(monthKey(rowDate), { label: `Tháng ${month + 1}`, income: 0, expense: 0, profit: 0 });
  }

  for (const item of transactions) {
    const row = rows.get(monthKey(item.occurredAt));
    if (row) applyTransaction(row, item);
  }

  return Array.from(rows.values());
}

function buildYearRevenue(transactions: ChartTransaction[], now: Date, fromYear?: number, toYear?: number) {
  const years = transactions.map((item) => item.occurredAt.getFullYear());
  const minYear = fromYear ?? (years.length > 0 ? Math.min(...years) : now.getFullYear());
  const maxYear = toYear ?? (years.length > 0 ? Math.max(...years, now.getFullYear()) : now.getFullYear());
  const rows = new Map<string, RevenuePoint>();

  for (let year = minYear; year <= maxYear; year += 1) {
    rows.set(String(year), { label: String(year), income: 0, expense: 0, profit: 0 });
  }

  for (const item of transactions) {
    const row = rows.get(yearKey(item.occurredAt));
    if (row) applyTransaction(row, item);
  }

  return Array.from(rows.values());
}

function buildRevenue(mode: ChartMode, transactions: ChartTransaction[], date: Date, now: Date, fromYear?: number, toYear?: number) {
  if (mode === "day") return buildDayRevenue(transactions, date);
  if (mode === "year") return buildYearRevenue(transactions, now, fromYear, toYear);
  return buildMonthRevenue(transactions, date);
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const now = new Date();
    const defaultYear = Math.min(MAX_DASHBOARD_YEAR, Math.max(MIN_DASHBOARD_YEAR, now.getFullYear()));
    const searchParams = new URL(request.url).searchParams;
    const chartMode = parseChartMode(searchParams.get("chartMode"));
    const selectedYear = clampNumber(searchParams.get("year"), defaultYear, MIN_DASHBOARD_YEAR, MAX_DASHBOARD_YEAR);
    const selectedMonth = clampNumber(searchParams.get("month"), now.getMonth() + 1, 1, 12);
    const fromYearRaw = clampNumber(searchParams.get("fromYear"), MIN_DASHBOARD_YEAR, MIN_DASHBOARD_YEAR, MAX_DASHBOARD_YEAR);
    const toYearRaw = clampNumber(searchParams.get("toYear"), selectedYear, MIN_DASHBOARD_YEAR, MAX_DASHBOARD_YEAR);
    const fromYear = Math.min(fromYearRaw, toYearRaw);
    const toYear = Math.max(fromYearRaw, toYearRaw);
    const chartDate = new Date(selectedYear, selectedMonth - 1, 1);
    const chartRange = getChartRange(chartMode, chartDate, fromYear, toYear);

    const [income, expense, recentTransactions, openInvoices, bookings, wallets, chartTransactions] = await Promise.all([
      prisma.transaction.aggregate({
        where: { studioId: user.studioId, type: "INCOME", deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { studioId: user.studioId, type: "EXPENSE", deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.transaction.findMany({
        where: { studioId: user.studioId, deletedAt: null, type: { in: ["INCOME", "EXPENSE"] } },
        take: 30,
        orderBy: { occurredAt: "desc" },
      }),
      prisma.invoice.findMany({
        where: { studioId: user.studioId, due: { gt: 0 }, deletedAt: null },
        take: 6,
        orderBy: { dueDate: "asc" },
      }),
      prisma.booking.findMany({
        where: { studioId: user.studioId, startAt: { gte: now }, status: { not: "COMPLETED" }, deletedAt: null },
        take: 30,
        orderBy: { startAt: "asc" },
      }),
      prisma.wallet.findMany({
        where: { studioId: user.studioId, isActive: true, deletedAt: null },
        orderBy: { createdAt: "asc" },
      }),
      prisma.transaction.findMany({
        where: {
          studioId: user.studioId,
          deletedAt: null,
          type: { in: ["INCOME", "EXPENSE"] },
          ...(chartRange ? { occurredAt: { gte: chartRange.start, lt: chartRange.end } } : {}),
        },
        select: { amount: true, type: true, occurredAt: true },
        orderBy: { occurredAt: "asc" },
      }),
    ]);

    const totalIncome = toNumber(income._sum.amount);
    const totalExpense = toNumber(expense._sum.amount);
    const revenue = buildRevenue(chartMode, chartTransactions, chartDate, now, fromYear, toYear);

    return ok({
      summary: {
        totalIncome,
        totalExpense,
        profit: totalIncome - totalExpense,
        unpaidDebt: openInvoices.reduce((sum, invoice) => sum + toNumber(invoice.due), 0),
      },
      revenue,
      monthly: revenue,
      recentTransactions,
      openInvoices,
      upcomingBookings: bookings,
      wallets,
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
