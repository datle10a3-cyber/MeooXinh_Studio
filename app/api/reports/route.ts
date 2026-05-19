import { fail, serverError } from "@/app/lib/api-response";
import { requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type CsvColumn<T> = {
  label: string;
  value: (row: T) => unknown;
  wrap?: boolean;
};

type FindManyDelegate<T> = {
  findMany: (args: Record<string, unknown>) => Promise<T[]>;
};

type ReportRow = Record<string, unknown> & {
  id?: string;
  title?: string | null;
  code?: string | null;
  name?: string | null;
  customerName?: string | null;
  packageName?: string | null;
  categoryName?: string | null;
  type?: string | null;
  status?: string | null;
  approvalStatus?: string | null;
  source?: string | null;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  salaryType?: string | null;
  workSchedule?: string | null;
  serial?: string | null;
  assignedTo?: string | null;
  bankName?: string | null;
  accountNo?: string | null;
  note?: string | null;
  amount?: unknown;
  total?: unknown;
  paid?: unknown;
  due?: unknown;
  dueAmount?: unknown;
  price?: unknown;
  deposit?: unknown;
  balance?: unknown;
  openingBalance?: unknown;
  totalSpent?: unknown;
  baseSalary?: unknown;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  occurredAt?: Date | string | null;
  issueDate?: Date | string | null;
  dueDate?: Date | string | null;
  deadlineAt?: Date | string | null;
  startAt?: Date | string | null;
  endAt?: Date | string | null;
  isActive?: boolean | null;
  wallet?: { name?: string | null } | null;
  customer?: { name?: string | null } | null;
  project?: { name?: string | null } | null;
  package?: { name?: string | null; category?: { name?: string | null } | null } | null;
  booking?: { title?: string | null } | null;
};

const EXPORT_BATCH_SIZE = 1000;
const EXPORT_MAX_ROWS = 50000;

const TXT = {
  staffDenied: "Nh\u00e2n vi\u00ean kh\u00f4ng c\u00f3 quy\u1ec1n xu\u1ea5t CSV.",
  unsupported: "Lo\u1ea1i b\u00e1o c\u00e1o ch\u01b0a \u0111\u01b0\u1ee3c h\u1ed7 tr\u1ee3.",
  unauthenticated: "Ch\u01b0a \u0111\u0103ng nh\u1eadp.",
  all: "T\u1ea5t c\u1ea3",
  transactions: "Thu chi",
  invoices: "H\u00f3a \u0111\u01a1n",
  booking: "Booking",
  projects: "D\u1ef1 \u00e1n",
  wallets: "V\u00ed",
  customers: "Kh\u00e1ch h\u00e0ng",
  employees: "Nh\u00e2n s\u1ef1",
  equipment: "Thi\u1ebft b\u1ecb",
  active: "\u0110ang d\u00f9ng",
  inactive: "T\u1ea1m ng\u01b0ng",
  group: "Nh\u00f3m",
  nameCode: "T\u00ean / M\u00e3",
  date: "Ng\u00e0y",
  amount: "S\u1ed1 ti\u1ec1n",
  status: "Tr\u1ea1ng th\u00e1i",
  note: "Ghi ch\u00fa",
  type: "Lo\u1ea1i",
  content: "N\u1ed9i dung",
  wallet: "V\u00ed",
  customer: "Kh\u00e1ch h\u00e0ng",
  project: "D\u1ef1 \u00e1n",
  invoiceCode: "M\u00e3 h\u00f3a \u0111\u01a1n",
  issueDate: "Ng\u00e0y xu\u1ea5t",
  dueDate: "H\u1ea1n thanh to\u00e1n",
  total: "T\u1ed5ng ti\u1ec1n",
  paid: "\u0110\u00e3 tr\u1ea3",
  debt: "C\u00f2n n\u1ee3",
  package: "G\u00f3i",
  category: "Danh m\u1ee5c",
  start: "B\u1eaft \u0111\u1ea7u",
  end: "K\u1ebft th\u00fac",
  deposit: "Ti\u1ec1n c\u1ecdc",
  projectCode: "M\u00e3 d\u1ef1 \u00e1n",
  projectName: "T\u00ean d\u1ef1 \u00e1n",
  value: "T\u1ed5ng gi\u00e1 tr\u1ecb",
  walletName: "T\u00ean v\u00ed",
  bank: "Ng\u00e2n h\u00e0ng",
  accountNo: "S\u1ed1 t\u00e0i kho\u1ea3n",
  openingBalance: "S\u1ed1 d\u01b0 \u0111\u1ea7u k\u1ef3",
  balance: "S\u1ed1 d\u01b0 hi\u1ec7n t\u1ea1i",
  customerName: "T\u00ean kh\u00e1ch",
  phone: "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i",
  source: "Ngu\u1ed3n kh\u00e1ch",
  spent: "T\u1ed5ng \u0111\u00e3 chi",
  createdAt: "Ng\u00e0y t\u1ea1o",
  employeeName: "T\u00ean nh\u00e2n s\u1ef1",
  address: "\u0110\u1ecba ch\u1ec9",
  position: "Ch\u1ee9c v\u1ee5",
  salaryType: "Ki\u1ec3u l\u01b0\u01a1ng",
  salary: "L\u01b0\u01a1ng",
  schedule: "L\u1ecbch l\u00e0m",
  equipmentName: "T\u00ean thi\u1ebft b\u1ecb",
  serial: "Serial",
  assignedTo: "\u0110ang giao cho",
};

function maybeRepairMojibake(text: string) {
  if (!/[\u00c3\u00c2\u00c4\u00c6]/.test(text)) return text;
  try {
    const bytes = Uint8Array.from(Array.from(text).map((char) => char.charCodeAt(0) & 0xff));
    const fixed = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const before = (text.match(/[\u00c3\u00c2\u00c4\u00c6]/g) ?? []).length;
    const after = (fixed.match(/[\u00c3\u00c2\u00c4\u00c6]/g) ?? []).length;
    return after < before ? fixed : text;
  } catch {
    return text;
  }
}

function cleanReportNote(value: unknown) {
  return maybeRepairMojibake(String(value ?? ""))
    .replace(/INVOICE_RESERVED:(?:Group-meoxinh\d+|meoxinh\d+)/gi, "")
    .replace(/^GROUP_BOOKING:.+$/gm, "")
    .replace(/GROUP_BOOKING_DONE:[^\n|]+/g, "")
    .replace(/BOOKING_DONE:[^\s|]+/g, "")
    .replace(/RECEIPT:\{.*?\}(?=\s*\||\n|$)/g, "")
    .replace(/Loại booking:\s*Booking nhóm(?:\s*-\s*[^\n.]+)?\.?/gi, "")
    .replace(/Tự động cộng doanh thu khi booking nhóm hoàn tất\.?/gi, "")
    .replace(/Tự động cộng doanh thu khi booking hoàn tất\.?/gi, "")
    .replace(/\|\s*Hóa đơn:\s*([^\s|]+)/gi, "Hóa đơn: $1")
    .replace(/\|\s*Tự động cộng doanh thu khi booking hoàn tất\.?/gi, "Tự động cộng doanh thu khi booking hoàn tất.")
    .replace(/\s*\|\s*/g, " - ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function wrapText(value: string, limit = 58) {
  const words = value.replace(/\r?\n/g, " ").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if ((current + " " + word).length > limit) {
      lines.push(current);
      current = word;
    } else {
      current += " " + word;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

function csvCell(value: unknown, wrap = false) {
  const text = maybeRepairMojibake(String(value ?? "")).replace(/\t/g, " ");
  const normalized = wrap ? wrapText(text) : text.replace(/\r?\n/g, " ");
  if (/["\t\r\n]/.test(normalized)) return `"${normalized.replace(/"/g, '""')}"`;
  return normalized;
}

function csvDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN");
}

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("vi-VN");
}

function buildCsv<T>(columns: CsvColumn<T>[], rows: T[]) {
  const delimiter = "\t";
  const header = columns.map((column) => csvCell(column.label)).join(delimiter);
  const body = rows.map((row) => columns.map((column) => csvCell(column.value(row), column.wrap)).join(delimiter));
  return [header, ...body].join("\r\n");
}

function csvResponse(csv: string, filename: string) {
  const bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(csv, "utf16le")]);
  return new Response(bytes, {
    headers: {
      "Content-Type": "text/csv; charset=utf-16le",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

type DateRange = { gte?: Date; lte?: Date };

function parseDateRange(url: URL): DateRange | null {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const range: DateRange = {};
  if (from) {
    const date = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(date.getTime())) range.gte = date;
  }
  if (to) {
    const date = new Date(`${to}T23:59:59.999`);
    if (!Number.isNaN(date.getTime())) range.lte = date;
  }
  return range.gte || range.lte ? range : null;
}

function withDateRange<T extends Record<string, unknown>>(where: T, field: string, range: DateRange | null) {
  return range ? { ...where, [field]: range } : where;
}

async function findManyInBatches<T>(delegate: FindManyDelegate<T>, args: Record<string, unknown>) {
  const rows: T[] = [];
  let cursor: string | null = null;
  while (rows.length < EXPORT_MAX_ROWS) {
    const batch = await delegate.findMany({
      ...args,
      take: Math.min(EXPORT_BATCH_SIZE, EXPORT_MAX_ROWS - rows.length),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    rows.push(...batch);
    if (batch.length < EXPORT_BATCH_SIZE) break;
    const last = batch[batch.length - 1] as Record<string, unknown>;
    cursor = String(last?.id ?? "");
    if (!cursor) break;
  }
  return rows;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (user.role === "STAFF") return fail(TXT.staffDenied, 403);

    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? "transactions";
    const range = parseDateRange(url);
    const baseWhere = { studioId: user.studioId, deletedAt: null };

    if (type === "all") {
      const [transactions, invoices, bookings, projects, wallets, customers, employees, equipment] = await Promise.all([
        findManyInBatches(prisma.transaction as unknown as FindManyDelegate<ReportRow>, { where: withDateRange(baseWhere, "occurredAt", range), orderBy: { occurredAt: "desc" } }),
        findManyInBatches(prisma.invoice as unknown as FindManyDelegate<ReportRow>, { where: withDateRange(baseWhere, "issueDate", range), include: { customer: true, project: true }, orderBy: { issueDate: "desc" } }),
        findManyInBatches(prisma.booking as unknown as FindManyDelegate<ReportRow>, { where: withDateRange(baseWhere, "startAt", range), orderBy: { startAt: "desc" } }),
        findManyInBatches(prisma.project as unknown as FindManyDelegate<ReportRow>, { where: withDateRange(baseWhere, "createdAt", range), orderBy: { createdAt: "desc" } }),
        findManyInBatches(prisma.wallet as unknown as FindManyDelegate<ReportRow>, { where: withDateRange(baseWhere, "createdAt", range), orderBy: { createdAt: "desc" } }),
        findManyInBatches(prisma.customer as unknown as FindManyDelegate<ReportRow>, { where: withDateRange(baseWhere, "createdAt", range), orderBy: { createdAt: "desc" } }),
        findManyInBatches(prisma.employee as unknown as FindManyDelegate<ReportRow>, { where: withDateRange(baseWhere, "createdAt", range), orderBy: { createdAt: "desc" } }),
        findManyInBatches(prisma.equipment as unknown as FindManyDelegate<ReportRow>, { where: withDateRange(baseWhere, "createdAt", range), orderBy: { createdAt: "desc" } }),
      ]);

      const rows = [
        ...transactions.map((row) => ({ group: TXT.transactions, name: row.title, date: row.occurredAt, amount: row.amount, status: row.approvalStatus, note: cleanReportNote(row.note) })),
        ...invoices.map((row) => ({ group: TXT.invoices, name: row.code, date: row.issueDate, amount: row.total, status: row.status, note: cleanReportNote(row.note) })),
        ...bookings.map((row) => ({ group: TXT.booking, name: row.customerName || row.title, date: row.startAt, amount: row.total, status: row.status, note: cleanReportNote(row.note) })),
        ...projects.map((row) => ({ group: TXT.projects, name: row.name, date: row.createdAt, amount: row.amount, status: row.status, note: cleanReportNote(row.note) })),
        ...wallets.map((row) => ({ group: TXT.wallets, name: row.name, date: row.createdAt, amount: row.balance, status: row.isActive ? TXT.active : TXT.inactive, note: row.type })),
        ...customers.map((row) => ({ group: TXT.customers, name: row.name, date: row.createdAt, amount: row.totalSpent, status: row.source, note: cleanReportNote(row.note) })),
        ...employees.map((row) => ({ group: TXT.employees, name: row.name, date: row.createdAt, amount: row.baseSalary, status: row.position, note: cleanReportNote(row.note) })),
        ...equipment.map((row) => ({ group: TXT.equipment, name: row.name, date: row.createdAt, amount: "", status: row.status, note: cleanReportNote(row.note) })),
      ];

      return csvResponse(
        buildCsv(
          [
            { label: TXT.group, value: (row) => row.group },
            { label: TXT.nameCode, value: (row) => row.name },
            { label: TXT.date, value: (row) => csvDate(row.date) },
            { label: TXT.amount, value: (row) => money(row.amount) },
            { label: TXT.status, value: (row) => row.status },
            { label: TXT.note, value: (row) => row.note, wrap: true },
          ],
          rows,
        ),
        "bao-cao-tat-ca.csv",
      );
    }

    if (type === "transactions") {
      const rows = await findManyInBatches(prisma.transaction as unknown as FindManyDelegate<ReportRow>, { where: withDateRange(baseWhere, "occurredAt", range), include: { wallet: true, customer: true, project: true }, orderBy: { occurredAt: "desc" } });
      return csvResponse(buildCsv([
        { label: TXT.date, value: (row) => csvDate(row.occurredAt) },
        { label: TXT.type, value: (row) => row.type },
        { label: TXT.content, value: (row) => row.title },
        { label: TXT.amount, value: (row) => money(row.amount) },
        { label: TXT.wallet, value: (row) => row.wallet?.name },
        { label: TXT.customer, value: (row) => row.customer?.name },
        { label: TXT.project, value: (row) => row.project?.name },
        { label: TXT.status, value: (row) => row.approvalStatus },
        { label: TXT.note, value: (row) => cleanReportNote(row.note), wrap: true },
      ], rows), "bao-cao-thu-chi.csv");
    }

    if (type === "invoices") {
      const rows = await findManyInBatches(prisma.invoice as unknown as FindManyDelegate<ReportRow>, { where: withDateRange(baseWhere, "issueDate", range), include: { customer: true, project: true }, orderBy: { issueDate: "desc" } });
      return csvResponse(buildCsv([
        { label: TXT.invoiceCode, value: (row) => row.code },
        { label: TXT.customer, value: (row) => row.customer?.name },
        { label: TXT.project, value: (row) => row.project?.name },
        { label: TXT.issueDate, value: (row) => csvDate(row.issueDate) },
        { label: TXT.dueDate, value: (row) => csvDate(row.dueDate) },
        { label: TXT.total, value: (row) => money(row.total) },
        { label: TXT.paid, value: (row) => money(row.paid) },
        { label: TXT.debt, value: (row) => money(row.due) },
        { label: TXT.status, value: (row) => row.status },
        { label: TXT.note, value: (row) => cleanReportNote(row.note), wrap: true },
      ], rows), "bao-cao-hoa-don.csv");
    }

    if (type === "bookings") {
      const rows = await findManyInBatches(prisma.booking as unknown as FindManyDelegate<ReportRow>, { where: withDateRange(baseWhere, "startAt", range), include: { customer: true, package: { include: { category: true } } }, orderBy: { startAt: "desc" } });
      return csvResponse(buildCsv([
        { label: TXT.customer, value: (row) => row.customerName || row.customer?.name || row.title },
        { label: TXT.package, value: (row) => row.packageName || row.package?.name },
        { label: TXT.category, value: (row) => row.categoryName || row.package?.category?.name },
        { label: TXT.start, value: (row) => csvDate(row.startAt) },
        { label: TXT.end, value: (row) => csvDate(row.endAt) },
        { label: TXT.deposit, value: (row) => money(row.deposit) },
        { label: TXT.total, value: (row) => money(row.total || row.price) },
        { label: TXT.status, value: (row) => row.status },
        { label: TXT.note, value: (row) => cleanReportNote(row.note), wrap: true },
      ], rows), "bao-cao-booking.csv");
    }

    if (type === "projects") {
      const rows = await findManyInBatches(prisma.project as unknown as FindManyDelegate<ReportRow>, { where: withDateRange(baseWhere, "createdAt", range), include: { customer: true, booking: true }, orderBy: { createdAt: "desc" } });
      return csvResponse(buildCsv([
        { label: TXT.projectCode, value: (row) => row.code },
        { label: TXT.projectName, value: (row) => row.name },
        { label: TXT.customer, value: (row) => row.customer?.name },
        { label: TXT.booking, value: (row) => row.booking?.title },
        { label: TXT.value, value: (row) => money(row.amount) },
        { label: TXT.debt, value: (row) => money(row.dueAmount) },
        { label: "Deadline", value: (row) => csvDate(row.deadlineAt) },
        { label: TXT.status, value: (row) => row.status },
        { label: TXT.note, value: (row) => cleanReportNote(row.note), wrap: true },
      ], rows), "bao-cao-du-an.csv");
    }

    if (type === "wallets") {
      const rows = await findManyInBatches(prisma.wallet as unknown as FindManyDelegate<ReportRow>, { where: withDateRange(baseWhere, "createdAt", range), orderBy: { createdAt: "desc" } });
      return csvResponse(buildCsv([
        { label: TXT.walletName, value: (row) => row.name },
        { label: TXT.type, value: (row) => row.type },
        { label: TXT.bank, value: (row) => row.bankName },
        { label: TXT.accountNo, value: (row) => row.accountNo },
        { label: TXT.openingBalance, value: (row) => money(row.openingBalance) },
        { label: TXT.balance, value: (row) => money(row.balance) },
        { label: TXT.status, value: (row) => (row.isActive ? TXT.active : TXT.inactive) },
      ], rows), "bao-cao-vi.csv");
    }

    if (type === "customers") {
      const rows = await findManyInBatches(prisma.customer as unknown as FindManyDelegate<ReportRow>, { where: withDateRange(baseWhere, "createdAt", range), orderBy: { createdAt: "desc" } });
      return csvResponse(buildCsv([
        { label: TXT.customerName, value: (row) => row.name },
        { label: TXT.phone, value: (row) => row.phone },
        { label: "Email", value: (row) => row.email },
        { label: TXT.source, value: (row) => row.source },
        { label: TXT.spent, value: (row) => money(row.totalSpent) },
        { label: TXT.createdAt, value: (row) => csvDate(row.createdAt) },
        { label: TXT.note, value: (row) => cleanReportNote(row.note), wrap: true },
      ], rows), "bao-cao-khach-hang.csv");
    }

    if (type === "employees") {
      const rows = await findManyInBatches(prisma.employee as unknown as FindManyDelegate<ReportRow>, { where: withDateRange(baseWhere, "createdAt", range), orderBy: { createdAt: "desc" } });
      return csvResponse(buildCsv([
        { label: TXT.employeeName, value: (row) => row.name },
        { label: TXT.phone, value: (row) => row.phone },
        { label: "Email", value: (row) => row.email },
        { label: TXT.address, value: (row) => row.address },
        { label: TXT.position, value: (row) => row.position },
        { label: TXT.salaryType, value: (row) => row.salaryType },
        { label: TXT.salary, value: (row) => money(row.baseSalary) },
        { label: TXT.schedule, value: (row) => row.workSchedule },
        { label: TXT.note, value: (row) => cleanReportNote(row.note), wrap: true },
      ], rows), "bao-cao-nhan-su.csv");
    }

    if (type === "equipment") {
      const rows = await findManyInBatches(prisma.equipment as unknown as FindManyDelegate<ReportRow>, { where: withDateRange(baseWhere, "createdAt", range), orderBy: { createdAt: "desc" } });
      return csvResponse(buildCsv([
        { label: TXT.equipmentName, value: (row) => row.name },
        { label: TXT.type, value: (row) => row.type },
        { label: TXT.serial, value: (row) => row.serial },
        { label: TXT.status, value: (row) => row.status },
        { label: TXT.assignedTo, value: (row) => row.assignedTo },
        { label: TXT.createdAt, value: (row) => csvDate(row.createdAt) },
        { label: TXT.note, value: (row) => cleanReportNote(row.note), wrap: true },
      ], rows), "bao-cao-thiet-bi.csv");
    }

    return fail(TXT.unsupported, 422);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail(TXT.unauthenticated, 401);
    return serverError(error);
  }
}
