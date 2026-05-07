import { fail, ok, serverError } from "@/app/lib/api-response";
import { requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { writeAuditLog } from "@/app/lib/audit";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

type BackupSection =
  | "categories"
  | "packages"
  | "customers"
  | "bookings"
  | "projects"
  | "wallets"
  | "walletShifts"
  | "transactions"
  | "invoices"
  | "employees"
  | "equipment"
  | "notifications"
  | "media";

type ImportStrategy = "merge" | "overwrite";

type BackupPayload = {
  version?: number;
  exportedAt?: string;
  studio?: { id?: string; name?: string; slug?: string } | null;
  data?: Partial<Record<BackupSection | "users", unknown[]>>;
};

type FindManyDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
};

const sectionLabels: Record<BackupSection, string> = {
  categories: "Danh mục",
  packages: "Gói chụp",
  customers: "Khách hàng",
  bookings: "Booking",
  projects: "Dự án",
  wallets: "Ví",
  walletShifts: "Sổ ca",
  transactions: "Thu chi",
  invoices: "Hóa đơn",
  employees: "Nhân sự",
  equipment: "Thiết bị",
  notifications: "Thông báo",
  media: "Thư viện ảnh",
};

const sectionOrder: BackupSection[] = [
  "categories",
  "packages",
  "customers",
  "wallets",
  "walletShifts",
  "bookings",
  "projects",
  "invoices",
  "transactions",
  "employees",
  "equipment",
  "notifications",
  "media",
];

const overwriteDeleteOrder: BackupSection[] = [
  "transactions",
  "walletShifts",
  "invoices",
  "projects",
  "bookings",
  "packages",
  "categories",
  "customers",
  "wallets",
  "employees",
  "equipment",
  "notifications",
  "media",
];

const fields: Record<BackupSection, string[]> = {
  categories: ["id", "name", "description", "createdAt", "updatedAt", "deletedAt"],
  packages: ["id", "categoryId", "name", "price", "description", "duration", "suitableFor", "includes", "deliverables", "outfitCount", "peopleCount", "location", "customerNote", "imageUrl", "galleryUrls", "createdAt", "updatedAt", "deletedAt"],
  customers: ["id", "name", "phone", "email", "avatarUrl", "galleryUrls", "source", "note", "totalSpent", "createdAt", "updatedAt", "deletedAt"],
  bookings: ["id", "customerId", "serviceId", "packageId", "customerName", "packageName", "categoryName", "price", "startTime", "endTime", "title", "imageUrl", "galleryUrls", "studioRoom", "startAt", "endAt", "status", "deposit", "total", "note", "createdAt", "updatedAt", "deletedAt"],
  projects: ["id", "bookingId", "customerId", "serviceId", "code", "name", "coverUrl", "galleryUrls", "status", "amount", "dueAmount", "deadlineAt", "folderUrl", "note", "createdAt", "updatedAt", "deletedAt"],
  wallets: ["id", "name", "type", "imageUrl", "galleryUrls", "bankName", "accountNo", "openingBalance", "balance", "isActive", "createdAt", "updatedAt", "deletedAt"],
  walletShifts: ["id", "walletId", "code", "openedById", "closedById", "status", "openingBalance", "totalIncome", "totalExpense", "expectedClosingBalance", "actualClosingBalance", "difference", "note", "closeNote", "openedAt", "closedAt", "createdAt", "updatedAt"],
  transactions: ["id", "walletId", "walletShiftId", "categoryId", "customerId", "projectId", "type", "title", "imageUrl", "galleryUrls", "amount", "method", "approvalStatus", "approvedBy", "attachmentUrl", "note", "occurredAt", "createdAt", "updatedAt", "deletedAt"],
  invoices: ["id", "customerId", "projectId", "code", "status", "imageUrl", "galleryUrls", "issueDate", "dueDate", "subtotal", "discount", "tax", "total", "paid", "due", "pdfUrl", "note", "createdAt", "updatedAt", "deletedAt"],
  employees: ["id", "userId", "name", "avatarUrl", "galleryUrls", "phone", "email", "position", "address", "salaryType", "baseSalary", "workSchedule", "note", "createdAt", "updatedAt", "deletedAt"],
  equipment: ["id", "name", "type", "imageUrl", "galleryUrls", "serial", "status", "assignedTo", "note", "createdAt", "updatedAt", "deletedAt"],
  notifications: ["id", "userId", "title", "message", "imageUrl", "galleryUrls", "type", "isRead", "dueAt", "createdAt", "deletedAt"],
  media: ["id", "userId", "url", "publicId", "filename", "mimeType", "type", "size", "width", "height", "provider", "createdAt"],
};

const delegateNames: Record<BackupSection, string> = {
  categories: "category",
  packages: "package",
  customers: "customer",
  bookings: "booking",
  projects: "project",
  wallets: "wallet",
  walletShifts: "walletShift",
  transactions: "transaction",
  invoices: "invoice",
  employees: "employee",
  equipment: "equipment",
  notifications: "notification",
  media: "media",
};

const dateFields = new Set(["createdAt", "updatedAt", "deletedAt", "startAt", "endAt", "startTime", "endTime", "deadlineAt", "occurredAt", "issueDate", "dueDate", "dueAt", "openedAt", "closedAt"]);
const BATCH_SIZE = 1000;
const userReferenceFields: Partial<Record<BackupSection, string[]>> = {
  walletShifts: ["openedById", "closedById"],
  employees: ["userId"],
  notifications: ["userId"],
  media: ["userId"],
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function rowsOf(backup: BackupPayload, section: BackupSection) {
  const rows = backup.data?.[section];
  return Array.isArray(rows) ? rows.filter((row) => asRecord(row)) as Record<string, unknown>[] : [];
}

function normalizeRow(row: Record<string, unknown>, section: BackupSection, studioId: string, validUserIds?: Set<string>) {
  const next: Record<string, unknown> = { studioId };
  for (const key of fields[section]) {
    if (!(key in row)) continue;
    const value = row[key];
    if (value === undefined) continue;
    next[key] = dateFields.has(key) && value ? new Date(String(value)) : value;
  }
  for (const key of userReferenceFields[section] ?? []) {
    const value = next[key];
    if (value && validUserIds && !validUserIds.has(String(value))) {
      next[key] = null;
    }
  }
  if (!next.id) delete next.id;
  return next;
}

function normalizeInvoiceItem(row: Record<string, unknown>, invoiceId: string) {
  return {
    id: row.id ? String(row.id) : undefined,
    invoiceId,
    description: String(row.description ?? "Dịch vụ"),
    quantity: Number(row.quantity ?? 1),
    unitPrice: row.unitPrice ?? 0,
    total: row.total ?? 0,
  };
}

function normalizePayment(row: Record<string, unknown>, studioId: string, invoiceId: string) {
  return {
    id: row.id ? String(row.id) : undefined,
    studioId,
    invoiceId,
    walletId: row.walletId ? String(row.walletId) : null,
    amount: row.amount ?? 0,
    method: String(row.method ?? "CASH"),
    paidAt: row.paidAt ? new Date(String(row.paidAt)) : new Date(),
    note: row.note ? String(row.note) : null,
  };
}

function withoutId(data: Record<string, unknown>) {
  const next = { ...data };
  delete next.id;
  return next;
}

function validateBackup(input: unknown): BackupPayload {
  const backup = asRecord(input) as BackupPayload | null;
  if (!backup || !asRecord(backup.data)) throw new Error("File JSON không đúng định dạng backup của Mèoo Xinhh.");
  return backup;
}

function previewBackup(backup: BackupPayload) {
  return {
    version: backup.version ?? "không rõ",
    exportedAt: backup.exportedAt ?? null,
    studioName: backup.studio?.name ?? null,
    sections: sectionOrder.map((key) => ({
      key,
      label: sectionLabels[key],
      count: rowsOf(backup, key).length,
    })),
  };
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

async function createPreRestoreBackup(studioId: string, user: { id: string; name: string; email: string; role: string }) {
  const sectionData: Partial<Record<BackupSection, Array<Record<string, unknown>>>> = {};
  for (const section of sectionOrder) {
    const delegate = (prisma as unknown as Record<string, FindManyDelegate>)[delegateNames[section]];
    sectionData[section] = await findAllByCursor(delegate, {
      where: { studioId },
      orderBy: section === "walletShifts" ? { openedAt: "desc" } : { createdAt: "desc" },
      ...(section === "invoices" ? { include: { items: true, payments: true } } : {}),
    });
  }

  const backup = {
    version: 1,
    type: "pre-restore",
    exportedAt: new Date().toISOString(),
    exportedBy: user,
    studio: await prisma.studio.findUnique({ where: { id: studioId } }),
    data: sectionData,
  };
  const dir = path.join(process.cwd(), "backups");
  await mkdir(dir, { recursive: true });
  const filename = `pre-restore-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const filePath = path.join(dir, filename);
  await writeFile(filePath, JSON.stringify(backup, null, 2), "utf8");
  return { filename, filePath };
}

async function upsertBasic(tx: typeof prisma, section: Exclude<BackupSection, "invoices">, rows: Record<string, unknown>[], studioId: string, validUserIds?: Set<string>) {
  const delegate = (tx as unknown as Record<string, unknown>)[delegateNames[section]] as {
    upsert: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
  };
  let imported = 0;
  for (const row of rows) {
    const data = normalizeRow(row, section, studioId, validUserIds);
    if (data.id) {
      await delegate.upsert({ where: { id: data.id }, update: withoutId(data), create: data });
    } else {
      await delegate.create({ data });
    }
    imported += 1;
  }
  return imported;
}

async function upsertInvoices(tx: typeof prisma, rows: Record<string, unknown>[], studioId: string, validUserIds?: Set<string>) {
  let imported = 0;
  for (const row of rows) {
    const data = normalizeRow(row, "invoices", studioId, validUserIds);
    const items = Array.isArray(row.items) ? row.items.filter((item) => asRecord(item)) as Record<string, unknown>[] : [];
    const payments = Array.isArray(row.payments) ? row.payments.filter((item) => asRecord(item)) as Record<string, unknown>[] : [];
    const invoice = data.id
      ? await tx.invoice.upsert({ where: { id: String(data.id) }, update: withoutId(data) as never, create: data as never })
      : await tx.invoice.create({ data: data as never });
    await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
    await tx.payment.deleteMany({ where: { invoiceId: invoice.id, studioId } });
    for (const item of items) await tx.invoiceItem.create({ data: normalizeInvoiceItem(item, invoice.id) as never });
    for (const payment of payments) await tx.payment.create({ data: normalizePayment(payment, studioId, invoice.id) as never });
    imported += 1;
  }
  return imported;
}

async function deleteSection(tx: typeof prisma, section: BackupSection, studioId: string) {
  if (section === "invoices") {
    const invoices = await tx.invoice.findMany({ where: { studioId }, select: { id: true } });
    const ids = invoices.map((row) => row.id);
    if (ids.length) {
      await tx.payment.deleteMany({ where: { studioId, invoiceId: { in: ids } } });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: { in: ids } } });
    }
    await tx.invoice.deleteMany({ where: { studioId } });
    return;
  }
  const delegate = (tx as unknown as Record<string, unknown>)[delegateNames[section]] as { deleteMany: (args: unknown) => Promise<unknown> };
  await delegate.deleteMany({ where: { studioId } });
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return fail("Chỉ quản trị viên mới được khôi phục dữ liệu.", 403);

    const body = await req.json();
    const action = String(body.action ?? "preview");
    const backup = validateBackup(body.backup);
    const requestedSections = Array.isArray(body.sections) ? body.sections.filter((item: unknown): item is BackupSection => sectionOrder.includes(item as BackupSection)) : [];
    const sections = requestedSections.length ? requestedSections : sectionOrder.filter((key) => rowsOf(backup, key).length > 0);
    const strategy: ImportStrategy = body.strategy === "overwrite" ? "overwrite" : "merge";

    if (action === "preview") return ok(previewBackup(backup));
    if (action !== "import") return fail("Thao tác không hợp lệ.", 400);
    if (!sections.length) return fail("Không có nhóm dữ liệu nào để khôi phục.", 400);

    const safetyBackup = await createPreRestoreBackup(user.studioId, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    const result = await prisma.$transaction(async (tx) => {
      const validUsers = await tx.user.findMany({ where: { studioId: user.studioId }, select: { id: true } });
      const validUserIds = new Set(validUsers.map((row) => row.id));

      if (strategy === "overwrite") {
        for (const section of overwriteDeleteOrder) {
          if (sections.includes(section)) await deleteSection(tx as typeof prisma, section, user.studioId);
        }
      }

      const imported: Record<string, number> = {};
      for (const section of sectionOrder) {
        if (!sections.includes(section)) continue;
        const rows = rowsOf(backup, section);
        if (!rows.length) {
          imported[section] = 0;
          continue;
        }
        imported[section] = section === "invoices"
          ? await upsertInvoices(tx as typeof prisma, rows, user.studioId, validUserIds)
          : await upsertBasic(tx as typeof prisma, section, rows, user.studioId, validUserIds);
      }
      return imported;
    }, { timeout: 60_000 });

    await writeAuditLog(user, "RESTORE_BACKUP", "Backup", undefined, {
      name: "Khôi phục dữ liệu JSON",
      strategy,
      sections,
      imported: result,
      backupVersion: backup.version ?? null,
      exportedAt: backup.exportedAt ?? null,
      safetyBackup: safetyBackup.filename,
    });

    return ok({
      strategy,
      imported: result,
      total: Object.values(result).reduce((sum, value) => sum + value, 0),
      safetyBackup,
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    if (error instanceof Error && error.message.includes("File JSON")) return fail(error.message, 400);
    return serverError(error);
  }
}
