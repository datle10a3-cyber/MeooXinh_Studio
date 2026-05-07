import { Prisma } from "@prisma/client";
import { fail, ok, serverError } from "@/app/lib/api-response";
import { requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type SearchItem = {
  id: string;
  type: string;
  label: string;
  title: string;
  subtitle: string;
  targetResource: string;
  targetPath: string;
  transactionView?: "income" | "expense";
  createdAt?: Date | string | null;
};

type CustomerHit = { id: string; name: string; phone: string | null; email: string | null; updatedAt: Date };
type BookingHit = { id: string; title: string; customerName: string | null; packageName: string | null; status: string; startAt: Date };
type ProjectHit = { id: string; code: string; name: string; status: string; updatedAt: Date };
type PackageHit = { id: string; name: string; price: Prisma.Decimal | number | string; updatedAt: Date };
type CategoryHit = { id: string; name: string; description: string | null; createdAt: Date };
type InvoiceHit = { id: string; code: string; due: Prisma.Decimal | number | string; issueDate: Date; customerName: string | null };
type TransactionHit = { id: string; title: string; type: string; amount: Prisma.Decimal | number | string; occurredAt: Date };
type EmployeeHit = { id: string; name: string; phone: string | null; position: string | null; updatedAt: Date };
type EquipmentHit = { id: string; name: string; serial: string | null; status: string; updatedAt: Date };

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
}

function sqlDateRange(column: Prisma.Sql, from: Date | null, to: Date | null) {
  if (from && to) return Prisma.sql`AND ${column} BETWEEN ${from} AND ${to}`;
  if (from) return Prisma.sql`AND ${column} >= ${from}`;
  if (to) return Prisma.sql`AND ${column} <= ${to}`;
  return Prisma.empty;
}

function sqlSearch(fields: Prisma.Sql[]) {
  return Prisma.join(fields.map((field) => Prisma.sql`coalesce(${field}, '')`), " || ' ' || ");
}

function searchWhere(fields: Prisma.Sql[], pattern: string) {
  const haystack = sqlSearch(fields);
  return Prisma.sql`vi_unaccent(${haystack}) LIKE vi_unaccent(${pattern})`;
}

function money(value: unknown) {
  return `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) return ok(url.searchParams.get("cursorMode") === "1" ? { items: [], nextOffset: null, hasMore: false } : []);

    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"), true);
    const limit = Math.min(Math.max(Number(url.searchParams.get("take") ?? 18), 1), 40);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
    const cursorMode = url.searchParams.get("cursorMode") === "1";
    const perTableLimit = Math.min(limit + offset + 10, 80);
    const pattern = `%${query}%`;
    const canViewFinance = user.role !== "STAFF";

    const [customers, bookings, projects, packages, categories, invoices, transactions, employees, equipment] = await Promise.all([
      prisma.$queryRaw<CustomerHit[]>`
        SELECT id, name, phone, email, "updatedAt"
        FROM "Customer"
        WHERE "studioId" = ${user.studioId}
          AND "deletedAt" IS NULL
          ${sqlDateRange(Prisma.sql`"updatedAt"`, from, to)}
          AND ${searchWhere([Prisma.sql`name`, Prisma.sql`phone`, Prisma.sql`email`, Prisma.sql`note`], pattern)}
        ORDER BY "updatedAt" DESC
        LIMIT ${perTableLimit}
      `,
      prisma.$queryRaw<BookingHit[]>`
        SELECT id, title, "customerName", "packageName", status, "startAt"
        FROM "Booking"
        WHERE "studioId" = ${user.studioId}
          AND "deletedAt" IS NULL
          ${sqlDateRange(Prisma.sql`"startAt"`, from, to)}
          AND ${searchWhere([Prisma.sql`"customerName"`, Prisma.sql`"packageName"`, Prisma.sql`"categoryName"`, Prisma.sql`title`, Prisma.sql`note`], pattern)}
        ORDER BY "startAt" DESC
        LIMIT ${perTableLimit}
      `,
      prisma.$queryRaw<ProjectHit[]>`
        SELECT id, code, name, status, "updatedAt"
        FROM "Project"
        WHERE "studioId" = ${user.studioId}
          AND "deletedAt" IS NULL
          ${sqlDateRange(Prisma.sql`"updatedAt"`, from, to)}
          AND ${searchWhere([Prisma.sql`code`, Prisma.sql`name`, Prisma.sql`note`], pattern)}
        ORDER BY "updatedAt" DESC
        LIMIT ${Math.min(perTableLimit, 40)}
      `,
      prisma.$queryRaw<PackageHit[]>`
        SELECT id, name, price, "updatedAt"
        FROM "Package"
        WHERE "studioId" = ${user.studioId}
          AND "deletedAt" IS NULL
          ${sqlDateRange(Prisma.sql`"updatedAt"`, from, to)}
          AND ${searchWhere([Prisma.sql`name`, Prisma.sql`description`, Prisma.sql`includes`], pattern)}
        ORDER BY "updatedAt" DESC
        LIMIT ${Math.min(perTableLimit, 40)}
      `,
      prisma.$queryRaw<CategoryHit[]>`
        SELECT id, name, description, "createdAt"
        FROM "Category"
        WHERE "studioId" = ${user.studioId}
          AND "deletedAt" IS NULL
          ${sqlDateRange(Prisma.sql`"createdAt"`, from, to)}
          AND ${searchWhere([Prisma.sql`name`, Prisma.sql`description`], pattern)}
        ORDER BY "createdAt" DESC
        LIMIT ${Math.min(perTableLimit, 30)}
      `,
      canViewFinance
        ? prisma.$queryRaw<InvoiceHit[]>`
          SELECT i.id, i.code, i.due, i."issueDate", c.name as "customerName"
          FROM "Invoice" i
          LEFT JOIN "Customer" c ON c.id = i."customerId"
          WHERE i."studioId" = ${user.studioId}
            AND i."deletedAt" IS NULL
            ${sqlDateRange(Prisma.sql`i."issueDate"`, from, to)}
            AND ${searchWhere([Prisma.sql`i.code`, Prisma.sql`i.note`, Prisma.sql`c.name`], pattern)}
          ORDER BY i."issueDate" DESC
          LIMIT ${Math.min(perTableLimit, 40)}
        `
        : Promise.resolve([]),
      canViewFinance
        ? prisma.$queryRaw<TransactionHit[]>`
          SELECT id, title, type, amount, "occurredAt"
          FROM "Transaction"
          WHERE "studioId" = ${user.studioId}
            AND "deletedAt" IS NULL
            ${sqlDateRange(Prisma.sql`"occurredAt"`, from, to)}
            AND ${searchWhere([Prisma.sql`title`, Prisma.sql`note`, Prisma.sql`amount::text`], pattern)}
          ORDER BY "occurredAt" DESC
          LIMIT ${perTableLimit}
        `
        : Promise.resolve([]),
      prisma.$queryRaw<EmployeeHit[]>`
        SELECT id, name, phone, position, "updatedAt"
        FROM "Employee"
        WHERE "studioId" = ${user.studioId}
          AND "deletedAt" IS NULL
          ${sqlDateRange(Prisma.sql`"updatedAt"`, from, to)}
          AND ${searchWhere([Prisma.sql`name`, Prisma.sql`phone`, Prisma.sql`email`, Prisma.sql`position`], pattern)}
        ORDER BY "updatedAt" DESC
        LIMIT ${Math.min(perTableLimit, 30)}
      `,
      prisma.$queryRaw<EquipmentHit[]>`
        SELECT id, name, serial, status, "updatedAt"
        FROM "Equipment"
        WHERE "studioId" = ${user.studioId}
          AND "deletedAt" IS NULL
          ${sqlDateRange(Prisma.sql`"updatedAt"`, from, to)}
          AND ${searchWhere([Prisma.sql`name`, Prisma.sql`type`, Prisma.sql`serial`, Prisma.sql`"assignedTo"`], pattern)}
        ORDER BY "updatedAt" DESC
        LIMIT ${Math.min(perTableLimit, 30)}
      `,
    ]);

    const items: SearchItem[] = [
      ...customers.map((row) => ({ id: row.id, type: "customers", label: "Khách", title: row.name, subtitle: row.phone || row.email || "Hồ sơ khách hàng", targetResource: "customers", targetPath: "/", createdAt: row.updatedAt })),
      ...bookings.map((row) => ({ id: row.id, type: "bookings", label: "Booking", title: row.customerName || row.title, subtitle: row.packageName || row.status, targetResource: row.status === "COMPLETED" ? "completed-bookings" : "booking", targetPath: row.status === "COMPLETED" ? "/completed-bookings" : "/booking", createdAt: row.startAt })),
      ...projects.map((row) => ({ id: row.id, type: "projects", label: "Dự án", title: row.name, subtitle: `${row.code} · ${row.status}`, targetResource: "projects", targetPath: "/", createdAt: row.updatedAt })),
      ...packages.map((row) => ({ id: row.id, type: "packages", label: "Gói", title: row.name, subtitle: money(row.price), targetResource: "packages", targetPath: "/packages", createdAt: row.updatedAt })),
      ...categories.map((row) => ({ id: row.id, type: "categories", label: "Danh mục", title: row.name, subtitle: row.description || "Nhóm dịch vụ", targetResource: "categories", targetPath: "/categories", createdAt: row.createdAt })),
      ...invoices.map((row) => ({ id: row.id, type: "invoices", label: "Hóa đơn", title: row.code, subtitle: `${row.customerName ?? "Khách hàng"} · còn nợ ${money(row.due)}`, targetResource: "invoices", targetPath: "/", createdAt: row.issueDate })),
      ...transactions.map((row) => {
        const transactionView = row.type === "EXPENSE" ? "expense" as const : "income" as const;
        return { id: row.id, type: "transactions", label: transactionView === "expense" ? "Khoản chi" : "Khoản thu", title: row.title, subtitle: money(row.amount), targetResource: "transactions", targetPath: "/", transactionView, createdAt: row.occurredAt };
      }),
      ...employees.map((row) => ({ id: row.id, type: "employees", label: "Nhân sự", title: row.name, subtitle: row.position || row.phone || "Nhân sự", targetResource: "users", targetPath: "/", createdAt: row.updatedAt })),
      ...equipment.map((row) => ({ id: row.id, type: "equipment", label: "Thiết bị", title: row.name, subtitle: row.serial || row.status || "Thiết bị", targetResource: "equipment", targetPath: "/", createdAt: row.updatedAt })),
    ].sort((a, b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime());

    const pageItems = items.slice(offset, offset + limit);
    if (cursorMode) {
      const nextOffset = offset + pageItems.length;
      return ok({
        items: pageItems,
        nextOffset: nextOffset < items.length ? nextOffset : null,
        hasMore: nextOffset < items.length,
      });
    }

    return ok(pageItems);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
