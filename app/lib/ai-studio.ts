import { prisma } from "@/app/lib/prisma";
import type { SessionUser } from "@/app/lib/auth";

export type AIChatMessage = {
  role: "user" | "assistant";
  content: string;
  imageUrls?: string[];
  imageDataUrls?: string[];
};

type AIProviderContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

type AIProviderMessage = {
  role: "system" | "user" | "assistant";
  content: AIProviderContent;
};

type StudioAIContext = Awaited<ReturnType<typeof getStudioAIContext>>;

export type AIActionSuggestionInput = {
  type: "CREATE_TRANSACTION" | "UPDATE_BOOKING_STATUS" | "OPEN_VIEW";
  title: string;
  description: string;
  payload: Record<string, unknown>;
};

const vnd = new Intl.NumberFormat("vi-VN");
const viDateTime = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function toNumber(value: unknown) {
  return Number(value ?? 0) || 0;
}

function money(value: unknown) {
  return `${vnd.format(toNumber(value))} đ`;
}

function dateText(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? "chưa có ngày" : viDateTime.format(date);
}

function dayRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

function previousMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const end = new Date(date.getFullYear(), date.getMonth(), 1);
  return { start, end };
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function includesAny(text: string, keywords: string[]) {
  const normalized = normalizeText(text);
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

export function canViewStudioFinance(role: SessionUser["role"] | string) {
  return role === "ADMIN" || role === "MANAGER";
}

export function isFinanceQuestion(text: string) {
  return includesAny(text, [
    "doanh thu",
    "doanh số",
    "lợi nhuận",
    "thu chi",
    "khoản thu",
    "khoản chi",
    "chi phí",
    "công nợ",
    "hóa đơn",
    "phiếu thu",
    "phiếu chi",
    "bill",
    "receipt",
    "invoice",
    "ví",
    "số dư",
    "tiền",
    "thanh toán",
    "đã trả",
    "chưa trả",
    "lương",
    "sổ ca",
    "ca ví",
    "mở ca",
    "đóng ca",
    "chốt ca",
    "qr chuyển khoản",
    "chuyển khoản",
  ]);
}

export function financeAccessDeniedAnswer() {
  return "Phần này liên quan đến doanh thu hoặc tiền bạc nên chỉ tài khoản Quản trị viên và Quản lý mới được hỏi nha. Tài khoản Nhân viên vẫn có thể hỏi về lịch booking, khách, gói chụp, dự án, thiết bị, thông báo hoặc thao tác sử dụng app.";
}

function listOrEmpty<T>(items: T[], map: (item: T, index: number) => string, limit = 8) {
  if (!items.length) return "chưa có dữ liệu";
  return items.slice(0, limit).map(map).join("\n");
}

function hasMedia(row: { imageUrl?: string | null; galleryUrls?: string | null }) {
  return Boolean(String(row.imageUrl ?? "").trim() || String(row.galleryUrls ?? "").trim());
}

function questionDateRange(question: string) {
  if (includesAny(question, ["tháng trước", "thang truoc"])) return previousMonthRange();
  if (includesAny(question, ["tháng này", "thang nay"])) return monthRange();
  if (includesAny(question, ["hôm nay", "hom nay", "today"])) return dayRange();
  return null;
}

function searchTokens(question: string) {
  const stopWords = new Set([
    "khach",
    "hang",
    "booking",
    "lich",
    "thang",
    "truoc",
    "nay",
    "hom",
    "chup",
    "gi",
    "nao",
    "chua",
    "co",
    "anh",
    "tim",
    "kiem",
    "cho",
    "toi",
    "minh",
    "cua",
  ]);
  return normalizeText(question)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3 && !stopWords.has(item))
    .slice(0, 6);
}

function messageContentForModel(message: AIChatMessage): AIProviderContent {
  const images = (message.imageDataUrls?.length ? message.imageDataUrls : message.imageUrls ?? []).filter(Boolean).slice(0, 3);
  if (!images.length) return message.content;
  return [
    { type: "text", text: message.content || "Người dùng đã gửi ảnh và cần AI phân tích." },
    ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];
}

function lastMessageIndexWithImage(messages: AIChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user" && Boolean(message.imageDataUrls?.length || message.imageUrls?.length)) return index;
  }
  return -1;
}

function roleLabel(role?: string | null) {
  if (role === "ADMIN") return "Quản trị viên";
  if (role === "MANAGER") return "Quản lý";
  if (role === "STAFF") return "Nhân viên";
  return role || "Chưa rõ vai trò";
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    PENDING: "Đang chờ",
    CONFIRMED: "Đã xác nhận",
    COMPLETED: "Đã hoàn tất",
    CANCELLED: "Đã hủy",
    CANCELED: "Đã hủy",
    DELIVERED: "Đã bàn giao",
    DRAFT: "Bản nháp",
    PAID: "Đã thanh toán",
    PARTIAL: "Thanh toán một phần",
    OVERDUE: "Quá hạn",
    APPROVED: "Đã duyệt",
    OPEN: "Đang mở",
    CLOSED: "Đã đóng",
    AVAILABLE: "Sẵn sàng",
    BUSY: "Đang bận",
    MAINTENANCE: "Bảo trì",
  };
  return labels[String(status ?? "")] ?? status ?? "Chưa rõ";
}

function actionLabel(action?: string | null, entity?: string | null) {
  const actionMap: Record<string, string> = {
    CREATE: "đã tạo",
    UPDATE: "đã sửa",
    DELETE: "đã xóa",
    RESTORE: "đã khôi phục dữ liệu",
    IMPORT: "đã nhập dữ liệu",
    LOGIN: "đã đăng nhập",
    LOGOUT: "đã đăng xuất",
    CLOSE_SHIFT: "đã đóng ca",
    OPEN_SHIFT: "đã mở ca",
  };
  const entityMap: Record<string, string> = {
    BOOKING: "booking",
    CUSTOMER: "khách hàng",
    TRANSACTION: "thu chi",
    INVOICE: "hóa đơn",
    PROJECT: "dự án",
    WALLET: "ví",
    WALLET_SHIFT: "ca ví",
    PACKAGE: "gói chụp",
    CATEGORY: "danh mục",
    EMPLOYEE: "nhân sự",
    EQUIPMENT: "thiết bị",
    NOTIFICATION: "thông báo",
  };
  return `${actionMap[String(action ?? "")] ?? action ?? "đã thao tác"} ${entityMap[String(entity ?? "")] ?? entity ?? ""}`.trim();
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function memoryKey(value: string) {
  const normalized = normalizeText(value).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  return normalized.slice(0, 90) || "ghi nho";
}

function extractMemoryCandidate(text: string) {
  const cleaned = compactText(text);
  if (!cleaned || cleaned.length < 8) return null;
  const normalized = normalizeText(cleaned);
  const explicit =
    normalized.includes("nho la") ||
    normalized.includes("ghi nho") ||
    normalized.includes("tu gio") ||
    normalized.includes("lan sau") ||
    normalized.includes("sau nay") ||
    normalized.includes("toi thich") ||
    normalized.includes("minh thich") ||
    normalized.includes("hay goi") ||
    normalized.includes("dung ") ||
    normalized.includes("luon ");
  if (!explicit) return null;

  let value = cleaned
    .replace(/^(hãy\s+)?(nhớ|ghi nhớ)\s*(là|rằng)?\s*/i, "")
    .replace(/^từ giờ\s*(trở đi)?\s*/i, "")
    .replace(/^lần sau\s*/i, "")
    .replace(/^sau này\s*/i, "")
    .trim();
  if (!value) value = cleaned;
  if (value.length > 260) value = `${value.slice(0, 257).trim()}...`;

  const type = includesAny(value, ["giọng", "trả lời", "xưng", "dễ thương", "chuyên nghiệp", "ngắn gọn", "chi tiết"])
    ? "STYLE"
    : includesAny(value, ["quy tắc", "luôn", "đừng", "ưu tiên", "booking", "thu chi", "hóa đơn", "ca", "ví"])
      ? "WORKFLOW_RULE"
      : "PREFERENCE";

  return { type, key: memoryKey(value), value };
}

export async function learnFromUserMessage(user: SessionUser, text: string) {
  const normalized = normalizeText(text);
  if (includesAny(normalized, ["xoa bo nho", "xoa ghi nho", "quen het", "dung nho nua"])) {
    await prisma.aiMemory.updateMany({
      where: { studioId: user.studioId, userId: user.id, isActive: true },
      data: { isActive: false },
    });
    return { notice: "Mình đã xóa bộ nhớ AI của tài khoản này rồi nha." };
  }

  const candidate = extractMemoryCandidate(text);
  if (!candidate) return null;
  await prisma.aiMemory.upsert({
    where: {
      studioId_userId_type_key: {
        studioId: user.studioId,
        userId: user.id,
        type: candidate.type,
        key: candidate.key,
      },
    },
    update: {
      value: candidate.value,
      source: text.slice(0, 500),
      confidence: 0.85,
      isActive: true,
      lastUsedAt: new Date(),
    },
    create: {
      studioId: user.studioId,
      userId: user.id,
      type: candidate.type,
      key: candidate.key,
      value: candidate.value,
      source: text.slice(0, 500),
      confidence: 0.85,
      lastUsedAt: new Date(),
    },
  });
  return { notice: "Mình đã ghi nhớ điều này cho những lần sau nha." };
}

export async function getStudioAIContext(user: SessionUser, question = "") {
  const now = new Date();
  const today = dayRange(now);
  const month = monthRange(now);
  const next30Days = new Date(now);
  next30Days.setDate(next30Days.getDate() + 30);
  const canViewFinance = canViewStudioFinance(user.role);
  const studioId = user.studioId;

  const [
    studio,
    currentUser,
    counts,
    todayBookings,
    upcomingBookings,
    completedBookingsThisMonth,
    recentBookings,
    customers,
    packages,
    categories,
    projects,
    employees,
    equipment,
    notifications,
    auditLogs,
    openShifts,
    recentClosedShifts,
    monthIncome,
    monthExpense,
    todayIncome,
    todayExpense,
    invoices,
    transactions,
    wallets,
    aiMemories,
  ] = await Promise.all([
    prisma.studio.findUnique({
      where: { id: studioId },
      select: { id: true, name: true, slug: true, email: true, phone: true, address: true, currency: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, email: true, phone: true, status: true, role: { select: { name: true } } },
    }),
    getStudioCounts(studioId, today, now),
    prisma.booking.findMany({
      where: { studioId, deletedAt: null, startAt: { gte: today.start, lt: today.end } },
      include: { package: { include: { category: true } }, customer: true },
      orderBy: { startAt: "asc" },
      take: 10,
    }),
    prisma.booking.findMany({
      where: {
        studioId,
        deletedAt: null,
        startAt: { gte: now, lte: next30Days },
        status: { notIn: ["COMPLETED", "CANCELLED", "CANCELED"] },
      },
      include: { package: { include: { category: true } }, customer: true },
      orderBy: { startAt: "asc" },
      take: 15,
    }),
    prisma.booking.findMany({
      where: { studioId, deletedAt: null, status: "COMPLETED", startAt: { gte: month.start, lt: month.end } },
      include: { package: { include: { category: true } }, customer: true },
      orderBy: { startAt: "desc" },
      take: 10,
    }),
    prisma.booking.findMany({
      where: { studioId, deletedAt: null },
      include: { package: { include: { category: true } }, customer: true },
      orderBy: { updatedAt: "desc" },
      take: 15,
    }),
    prisma.customer.findMany({
      where: { studioId, deletedAt: null },
      orderBy: [{ totalSpent: "desc" }, { updatedAt: "desc" }],
      take: 15,
    }),
    prisma.package.findMany({
      where: { studioId, deletedAt: null },
      include: { category: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.category.findMany({ where: { studioId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.project.findMany({
      where: { studioId, deletedAt: null },
      include: { customer: true, booking: true },
      orderBy: [{ deadlineAt: "asc" }, { updatedAt: "desc" }],
      take: 15,
    }),
    prisma.employee.findMany({ where: { studioId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.equipment.findMany({
      where: { studioId, deletedAt: null },
      include: { maintenance: { orderBy: { servicedAt: "desc" }, take: 2 } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 15,
    }),
    prisma.notification.findMany({ where: { studioId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.auditLog.findMany({
      where: { studioId },
      include: { user: { select: { name: true, role: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.walletShift.findMany({
      where: { studioId, status: "OPEN" },
      include: {
        openedBy: { select: { name: true, role: { select: { name: true } } } },
        closedBy: { select: { name: true, role: { select: { name: true } } } },
      },
      orderBy: { openedAt: "desc" },
      take: 10,
    }),
    prisma.walletShift.findMany({
      where: { studioId, status: "CLOSED" },
      include: {
        openedBy: { select: { name: true, role: { select: { name: true } } } },
        closedBy: { select: { name: true, role: { select: { name: true } } } },
      },
      orderBy: { closedAt: "desc" },
      take: 10,
    }),
    canViewFinance
      ? prisma.transaction.aggregate({
          where: { studioId, deletedAt: null, type: "INCOME", approvalStatus: "APPROVED", occurredAt: { gte: month.start, lt: month.end } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: 0 } }),
    canViewFinance
      ? prisma.transaction.aggregate({
          where: { studioId, deletedAt: null, type: "EXPENSE", approvalStatus: "APPROVED", occurredAt: { gte: month.start, lt: month.end } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: 0 } }),
    canViewFinance
      ? prisma.transaction.aggregate({
          where: { studioId, deletedAt: null, type: "INCOME", approvalStatus: "APPROVED", occurredAt: { gte: today.start, lt: today.end } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: 0 } }),
    canViewFinance
      ? prisma.transaction.aggregate({
          where: { studioId, deletedAt: null, type: "EXPENSE", approvalStatus: "APPROVED", occurredAt: { gte: today.start, lt: today.end } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: 0 } }),
    canViewFinance
      ? prisma.invoice.findMany({
          where: { studioId, deletedAt: null },
          include: { customer: true, project: true, items: true },
          orderBy: [{ due: "desc" }, { issueDate: "desc" }],
          take: 15,
        })
      : Promise.resolve([]),
    canViewFinance
      ? prisma.transaction.findMany({
          where: { studioId, deletedAt: null },
          include: { customer: true, project: true, wallet: true, category: true, walletShift: true },
          orderBy: { occurredAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    canViewFinance ? prisma.wallet.findMany({ where: { studioId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 10 }) : Promise.resolve([]),
    prisma.aiMemory.findMany({
      where: { studioId, isActive: true, OR: [{ userId: null }, { userId: user.id }] },
      orderBy: [{ updatedAt: "desc" }],
      take: 15,
    }),
  ]);

  const monthIncomeValue = toNumber(monthIncome._sum.amount);
  const monthExpenseValue = toNumber(monthExpense._sum.amount);
  const todayIncomeValue = toNumber(todayIncome._sum.amount);
  const todayExpenseValue = toNumber(todayExpense._sum.amount);
  const unpaidInvoices = invoices.filter((invoice) => toNumber(invoice.due) > 0);
  const completedRevenue = completedBookingsThisMonth.reduce((sum, booking) => sum + toNumber(booking.total ?? booking.price), 0);
  const totalDebt = unpaidInvoices.reduce((sum, invoice) => sum + toNumber(invoice.due), 0);
  const deepSearch = await getDeepSearchContext(user, question, canViewFinance);

  return {
    now,
    today,
    month,
    canViewFinance,
    userRole: user.role,
    counts,
    studio: {
      id: studio?.id,
      name: studio?.name ?? "chưa cập nhật",
      slug: studio?.slug ?? "chưa cập nhật",
      email: studio?.email ?? "chưa cập nhật",
      phone: studio?.phone ?? "chưa cập nhật",
      address: studio?.address ?? "chưa cập nhật",
      currency: studio?.currency ?? "VND",
    },
    currentUser: {
      id: currentUser?.id ?? user.id,
      name: currentUser?.name ?? user.name,
      email: currentUser?.email ?? user.email,
      phone: currentUser?.phone ?? "chưa cập nhật",
      role: currentUser?.role?.name ?? user.role,
      roleLabel: roleLabel(currentUser?.role?.name ?? user.role),
      status: currentUser?.status ?? "chưa cập nhật",
    },
    finance: {
      todayIncome: todayIncomeValue,
      todayExpense: todayExpenseValue,
      todayProfit: todayIncomeValue - todayExpenseValue,
      monthIncome: monthIncomeValue,
      monthExpense: monthExpenseValue,
      monthProfit: monthIncomeValue - monthExpenseValue,
      completedBookingRevenueThisMonth: completedRevenue,
      totalDebt,
      unpaidInvoiceCount: unpaidInvoices.length,
      invoices,
      transactions,
      wallets,
      openShifts,
      recentClosedShifts,
    },
    bookings: {
      today: todayBookings,
      upcoming: upcomingBookings,
      completedThisMonth: completedBookingsThisMonth,
      recent: recentBookings,
    },
    customers,
    packages,
    categories,
    projects,
    employees,
    equipment,
    notifications,
    auditLogs,
    aiMemories,
    deepSearch,
  };
}

async function getDeepSearchContext(user: SessionUser, question: string, canViewFinance: boolean) {
  const normalizedQuestion = normalizeText(question);
  const wantsBooking = includesAny(normalizedQuestion, ["booking", "lich", "chup", "khach"]);
  const wantsMissingImage = includesAny(normalizedQuestion, ["chua co anh", "thieu anh", "khong co anh", "booking nao chua co anh", "chưa có ảnh"]);
  const wantsCustomer = includesAny(normalizedQuestion, ["khach", "nguyen", "sdt", "so dien thoai"]);
  const range = questionDateRange(question);
  const tokens = searchTokens(question);

  if (!question.trim() || (!wantsBooking && !wantsMissingImage && !wantsCustomer && !isFinanceQuestion(question))) {
    return {
      reason: "Không cần tìm sâu cho câu hỏi này.",
      tokens,
      matchedBookings: [],
      missingImageBookings: [],
      matchedCustomers: [],
      matchedTransactions: [],
    };
  }

  const bookingWhere = {
    studioId: user.studioId,
    deletedAt: null,
    ...(range ? { startAt: { gte: range.start, lt: range.end } } : {}),
  };

  const [bookingRows, missingImageRows, customerRows, transactionRows] = await Promise.all([
    wantsBooking || wantsCustomer
      ? prisma.booking.findMany({
          where: bookingWhere,
          include: { customer: true, package: { include: { category: true } } },
          orderBy: { startAt: "desc" },
          take: range ? 100 : 60,
        })
      : Promise.resolve([]),
    wantsMissingImage
      ? prisma.booking.findMany({
          where: {
            studioId: user.studioId,
            deletedAt: null,
            OR: [{ imageUrl: null }, { imageUrl: "" }, { galleryUrls: null }, { galleryUrls: "" }],
          },
          include: { customer: true, package: { include: { category: true } } },
          orderBy: { startAt: "desc" },
          take: 40,
        })
      : Promise.resolve([]),
    wantsCustomer
      ? prisma.customer.findMany({
          where: { studioId: user.studioId, deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 80,
        })
      : Promise.resolve([]),
    canViewFinance && isFinanceQuestion(question)
      ? prisma.transaction.findMany({
          where: { studioId: user.studioId, deletedAt: null, ...(range ? { occurredAt: { gte: range.start, lt: range.end } } : {}) },
          include: { customer: true, project: true, wallet: true },
          orderBy: { occurredAt: "desc" },
          take: 60,
        })
      : Promise.resolve([]),
  ]);

  const matchesTokens = (text: string) => !tokens.length || tokens.some((token) => normalizeText(text).includes(token));
  const matchedBookings = bookingRows
    .filter((item) =>
      matchesTokens(
        [item.customerName, item.title, item.packageName, item.categoryName, item.customer?.name, item.customer?.phone, item.package?.name, item.package?.category?.name]
          .filter(Boolean)
          .join(" "),
      ),
    )
    .slice(0, 40);
  const matchedCustomers = customerRows
    .filter((item) => matchesTokens([item.name, item.phone, item.email, item.note].filter(Boolean).join(" ")))
    .slice(0, 30);
  const matchedTransactions = transactionRows
    .filter((item) => matchesTokens([item.title, item.note, item.customer?.name, item.project?.name, item.wallet?.name].filter(Boolean).join(" ")))
    .slice(0, 30);

  return {
    reason: range
      ? `Tìm sâu theo khoảng ${dateText(range.start)} đến ${dateText(range.end)}.`
      : wantsMissingImage
        ? "Tìm sâu các booking thiếu ảnh."
        : "Tìm sâu theo từ khóa trong dữ liệu studio.",
    tokens,
    matchedBookings,
    missingImageBookings: missingImageRows.filter((item) => !hasMedia(item)).slice(0, 40),
    matchedCustomers,
    matchedTransactions,
  };
}

export function summarizeAIContext(context: StudioAIContext) {
  return [
    `Đồng bộ lúc ${dateText(context.now)}`,
    `Quyền tài chính: ${context.canViewFinance ? "được xem" : "đã ẩn"}`,
    `Booking hôm nay: ${context.bookings.today.length}`,
    `Booking sắp tới: ${context.bookings.upcoming.length}`,
    `Booking khớp tìm sâu: ${context.deepSearch.matchedBookings.length}`,
    `Booking chưa có ảnh: ${context.deepSearch.missingImageBookings.length}`,
    `Khách khớp tìm sâu: ${context.deepSearch.matchedCustomers.length}`,
    context.canViewFinance ? `Thu chi khớp tìm sâu: ${context.deepSearch.matchedTransactions.length}` : "Thu chi tìm sâu: ẩn theo quyền",
    `Nhật ký hoạt động đưa vào context: ${context.auditLogs.length}`,
  ].join(" | ");
}

function parseAmount(text: string) {
  const normalized = normalizeText(text).replace(/,/g, ".");
  const million = normalized.match(/(\d+(?:\.\d+)?)\s*(trieu|tr)\b/);
  if (million) return Math.round(Number(million[1]) * 1_000_000);
  const thousand = normalized.match(/(\d+(?:\.\d+)?)\s*(nghin|k)\b/);
  if (thousand) return Math.round(Number(thousand[1]) * 1_000);
  const raw = text.match(/(\d[\d.,\s]{3,})/);
  if (!raw) return 0;
  return Number(raw[1].replace(/[^\d]/g, "")) || 0;
}

export async function createAIActionSuggestions(user: SessionUser, question: string, context: StudioAIContext) {
  if (!canViewStudioFinance(user.role)) return [];
  const suggestions: AIActionSuggestionInput[] = [];
  const amount = parseAmount(question);
  const wantsCreateTransaction = includesAny(question, ["tạo khoản thu", "tạo khoản chi", "thêm khoản thu", "thêm khoản chi", "ghi khoản thu", "ghi khoản chi"]);
  if (wantsCreateTransaction && amount > 0) {
    const type = includesAny(question, ["khoản chi", "them chi", "thêm chi", "ghi chi"]) ? "EXPENSE" : "INCOME";
    const wallet = context.finance.wallets.find((item) => item.isActive) ?? context.finance.wallets[0];
    if (wallet) {
      suggestions.push({
        type: "CREATE_TRANSACTION",
        title: type === "INCOME" ? "Tạo khoản thu từ đề xuất AI" : "Tạo khoản chi từ đề xuất AI",
        description: `${type === "INCOME" ? "Khoản thu" : "Khoản chi"} ${money(amount)} vào ví ${wallet.name}. Admin/quản lý cần kiểm tra lại trước khi xác nhận.`,
        payload: {
          type,
          title: question.slice(0, 120),
          amount,
          walletId: wallet.id,
          method: wallet.type ?? "CASH",
          occurredAt: new Date().toISOString(),
          note: `Tạo từ đề xuất AI. Câu hỏi gốc: ${question.slice(0, 300)}`,
        },
      });
    }
  }

  const wantsCompleteBooking = includesAny(question, ["hoàn tất booking", "chuyển booking hoàn tất", "đánh dấu booking hoàn tất"]);
  if (wantsCompleteBooking && context.deepSearch.matchedBookings.length === 1) {
    const booking = context.deepSearch.matchedBookings[0];
    suggestions.push({
      type: "UPDATE_BOOKING_STATUS",
      title: "Đánh dấu booking hoàn tất",
      description: `Chuyển booking ${booking.customerName || booking.customer?.name || booking.title} sang trạng thái hoàn tất. Cần kiểm tra kỹ trước khi xác nhận.`,
      payload: { bookingId: booking.id, status: "COMPLETED" },
    });
  }

  if (context.deepSearch.missingImageBookings.length > 0 && includesAny(question, ["booking nào chưa có ảnh", "chưa có ảnh", "thiếu ảnh"])) {
    suggestions.push({
      type: "OPEN_VIEW",
      title: "Mở danh sách booking thiếu ảnh",
      description: `Có ${context.deepSearch.missingImageBookings.length} booking trong kết quả tìm sâu chưa có ảnh. Mở trang booking để xử lý từng mục.`,
      payload: { view: "bookings", highlightIds: context.deepSearch.missingImageBookings.slice(0, 20).map((item) => item.id) },
    });
  }

  if (!suggestions.length) return [];
  await prisma.aiActionSuggestion.createMany({
    data: suggestions.map((item) => ({
      studioId: user.studioId,
      userId: user.id,
      type: item.type,
      title: item.title,
      description: item.description,
      payload: JSON.stringify(item.payload),
    })),
  });
  return suggestions;
}

export async function writeAIAuditLog(input: {
  user: SessionUser;
  question: string;
  answer: string;
  mode: string;
  sourceSummary?: string;
  imageCount?: number;
  blocked?: boolean;
}) {
  await prisma.aiAuditLog.create({
    data: {
      studioId: input.user.studioId,
      userId: input.user.id,
      question: input.question.slice(0, 2000),
      answer: input.answer.slice(0, 6000),
      mode: input.mode,
      sourceSummary: input.sourceSummary?.slice(0, 3000),
      imageCount: input.imageCount ?? 0,
      blocked: input.blocked ?? false,
    },
  });
}

async function getStudioCounts(studioId: string, today: { start: Date; end: Date }, now: Date) {
  const [
    categories,
    packages,
    bookings,
    bookingsToday,
    bookingsUpcoming,
    bookingsCompleted,
    customers,
    projects,
    projectsOpen,
    invoices,
    invoicesUnpaid,
    incomeTransactions,
    expenseTransactions,
    wallets,
    openShifts,
    employees,
    equipment,
    equipmentNeedsAttention,
    notificationsUnread,
    auditLogs,
  ] = await Promise.all([
    prisma.category.count({ where: { studioId, deletedAt: null } }),
    prisma.package.count({ where: { studioId, deletedAt: null } }),
    prisma.booking.count({ where: { studioId, deletedAt: null } }),
    prisma.booking.count({ where: { studioId, deletedAt: null, startAt: { gte: today.start, lt: today.end } } }),
    prisma.booking.count({
      where: { studioId, deletedAt: null, startAt: { gte: now }, status: { notIn: ["COMPLETED", "CANCELLED", "CANCELED"] } },
    }),
    prisma.booking.count({ where: { studioId, deletedAt: null, status: "COMPLETED" } }),
    prisma.customer.count({ where: { studioId, deletedAt: null } }),
    prisma.project.count({ where: { studioId, deletedAt: null } }),
    prisma.project.count({ where: { studioId, deletedAt: null, status: { notIn: ["COMPLETED", "DELIVERED", "CANCELLED", "CANCELED"] } } }),
    prisma.invoice.count({ where: { studioId, deletedAt: null } }),
    prisma.invoice.count({ where: { studioId, deletedAt: null, due: { gt: 0 } } }),
    prisma.transaction.count({ where: { studioId, deletedAt: null, type: "INCOME" } }),
    prisma.transaction.count({ where: { studioId, deletedAt: null, type: "EXPENSE" } }),
    prisma.wallet.count({ where: { studioId, deletedAt: null } }),
    prisma.walletShift.count({ where: { studioId, status: "OPEN" } }),
    prisma.employee.count({ where: { studioId, deletedAt: null } }),
    prisma.equipment.count({ where: { studioId, deletedAt: null } }),
    prisma.equipment.count({ where: { studioId, deletedAt: null, status: { not: "AVAILABLE" } } }),
    prisma.notification.count({ where: { studioId, deletedAt: null, isRead: false } }),
    prisma.auditLog.count({ where: { studioId } }),
  ]);

  return {
    categories,
    packages,
    bookings,
    bookingsToday,
    bookingsUpcoming,
    bookingsCompleted,
    customers,
    projects,
    projectsOpen,
    invoices,
    invoicesUnpaid,
    incomeTransactions,
    expenseTransactions,
    wallets,
    openShifts,
    employees,
    equipment,
    equipmentNeedsAttention,
    notificationsUnread,
    auditLogs,
  };
}

export function buildStudioAIMessages(messages: AIChatMessage[], context: StudioAIContext): AIProviderMessage[] {
  const roleNotice = context.canViewFinance
    ? "Người dùng hiện tại được xem dữ liệu tài chính."
    : "Người dùng hiện tại là nhân viên. Tuyệt đối không tiết lộ doanh thu, lợi nhuận, thu chi, ví, ca ví, số dư, công nợ, hóa đơn, thanh toán, lương hoặc bất kỳ số liệu tiền bạc nào. Nếu bị hỏi tài chính, hoặc ảnh gửi lên là hóa đơn/phiếu thu/QR/chứng từ tiền bạc, hãy từ chối ngắn gọn và nói phần này chỉ dành cho Quản trị viên hoặc Quản lý.";
  const recentMessages = messages.slice(-6);
  const lastImageMessageIndex = lastMessageIndexWithImage(recentMessages);

  return [
    {
      role: "system",
      content:
        "Bạn là trợ lý AI vận hành cho studio chụp ảnh tại Việt Nam. Giọng trả lời dễ thương, ấm áp, chuyên nghiệp và đáng tin: mềm mại như trợ lý thân thiết, nhưng số liệu và hướng dẫn phải rõ ràng. Luôn trả lời bằng tiếng Việt có dấu, tự nhiên, đầy đủ vừa đủ và đúng trọng tâm. Không dùng tiếng Anh trong tiêu đề hoặc nhãn. Trả lời theo cấu trúc dễ đọc: kết luận nhanh trước, sau đó các ý quan trọng, số liệu liên quan, và việc nên làm tiếp theo nếu cần. Nếu câu hỏi đơn giản thì trả lời ngắn gọn, không dài dòng. Cuối mỗi câu trả lời thêm đúng 1 emoji mặt cảm xúc phù hợp ngữ cảnh, ví dụ: 🙂, 😊, 😄, 🥰, 😌, 🤔, 😅, 😎, 🙏. Không chọn ngẫu nhiên, không dùng ký hiệu trang trí, không dùng quá nhiều emoji.",
    },
    {
      role: "system",
      content:
        "Dữ liệu studio bên dưới là ảnh chụp đã đồng bộ từ PostgreSQL ở thời điểm hiện tại. Chỉ dựa trên dữ liệu này; không bịa số liệu, tên khách, lịch, tiền, số điện thoại hoặc trạng thái. Nếu thiếu dữ liệu thì nói rõ là chưa có dữ liệu trong hệ thống. Khi nói về tiền phải ghi đơn vị đồng.",
    },
    {
      role: "system",
      content:
        "Ưu tiên cách trả lời như một quản lý studio: tra cứu nhanh, tóm tắt rủi ro, nhắc việc cần làm, và hướng dẫn thao tác trong app. Với câu hỏi phân tích, nêu 1-3 nhận xét chính và việc nên làm. Với câu hỏi tra cứu, trả lời bằng danh sách ngắn, có ngày giờ nếu liên quan.",
    },
    {
      role: "system",
      content:
        "Nếu người dùng gửi ảnh, hãy phân tích nội dung ảnh trước rồi liên hệ với dữ liệu studio nếu phù hợp. Có thể hỗ trợ đọc hóa đơn, phiếu thu, ảnh QR, ảnh khách, ảnh thiết bị, ảnh lỗi giao diện hoặc ảnh chứng từ. Nếu ảnh mờ hoặc thiếu thông tin thì nói nhẹ nhàng là cần ảnh rõ hơn, không đoán bừa.",
    },
    {
      role: "system",
      content:
        "Nếu CONTEXT có Bộ nhớ AI đã học, hãy tôn trọng các ghi nhớ đó khi trả lời. Chỉ xem đó là sở thích, quy tắc giao tiếp hoặc quy tắc vận hành; không dùng bộ nhớ để thay đổi dữ liệu nghiệp vụ nếu người dùng chưa thao tác trong app.",
    },
    { role: "system", content: roleNotice },
    { role: "system", content: `DỮ LIỆU STUDIO ĐÃ ĐỒNG BỘ:\n${contextForModel(context)}` },
    ...recentMessages.map((message, index) => ({
      role: message.role,
      content: index === lastImageMessageIndex ? messageContentForModel(message) : message.content,
    })),
  ];
}

function friendlyFallbackReason(reason?: string) {
  if (!reason) return "";
  const lower = reason.toLowerCase();
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("tokens per day") || lower.includes("tpd")) {
    return "AI đang bận hoặc đã chạm giới hạn tạm thời";
  }
  if (lower.includes("401") || lower.includes("403") || lower.includes("api_key") || lower.includes("groq_api_key")) {
    return "cấu hình AI cần được kiểm tra lại";
  }
  if (lower.includes("{") || lower.includes("error") || lower.includes("model") || lower.length > 90) {
    return "AI bên ngoài đang bận tạm thời";
  }
  return reason;
}

const aiFaceEmojis = ["🙂", "😊", "😄", "🥰", "😌", "🤔", "😅", "😎", "🙏"];

function contextualFaceEmoji(text: string, question: string) {
  const mood = normalizeText(`${question} ${text}`);
  if (/(bao mat|canh bao|nguy hiem|khan cap|bi lo|hack|loi nghiem trong)/.test(mood)) return "🙏";
  if (/(loi|ban|gioi han|khong the|chua the|that bai|tu choi|khong duoc quyen|khong co quyen)/.test(mood)) return "😅";
  if (/(goi y|nen|kiem tra|phan tich|vi sao|tai sao|can xem|can ra soat)/.test(mood)) return "🤔";
  if (/(doanh thu|bao cao|so lieu|tong quan|thong ke|loi nhuan|thu chi|hoa don)/.test(mood)) return "😎";
  if (/(cam on|xin chao|chao ban|de thuong|rat vui|nha)/.test(mood)) return "🥰";
  if (/(xong|hoan tat|thanh cong|da cap nhat|da dong bo|on roi|tot)/.test(mood)) return "😊";
  return "🙂";
}

function appendFaceEmoji(text: string, question: string) {
  const trimmed = text.trimEnd();
  if (!trimmed || aiFaceEmojis.some((emoji) => trimmed.endsWith(emoji))) return trimmed;
  return `${trimmed} ${contextualFaceEmoji(trimmed, question)}`;
}

export function fallbackStudioAnswer(question: string, context: StudioAIContext, reason?: string, imageCount = 0) {
  const lower = question.trim();
  reason = friendlyFallbackReason(reason);
  const prefix = reason ? `AI đang dùng chế độ trả lời nội bộ vì: ${reason}\n\n` : "";

  if (imageCount > 0 && reason) {
    return appendFaceEmoji(`${prefix}Mình đã nhận ${imageCount} ảnh rồi nha. Hiện chế độ nội bộ chưa đọc trực tiếp được nội dung ảnh, nhưng bạn mô tả thêm ảnh đó là hóa đơn, QR, khách, thiết bị hay lỗi giao diện thì mình sẽ đối chiếu với dữ liệu studio và hỗ trợ ngay.`, question);
  }
  if (!question.trim()) return appendFaceEmoji(`${prefix}Bạn nhập câu hỏi giúp mình nhé.`, question);
  if (/^(hi|hello|hey|chào|xin chào|alo|ê|test|ok|ừ|uh|haha|hehe)\b/i.test(normalizeText(lower))) {
    return `${prefix}Chào bạn, mình đã đồng bộ dữ liệu studio. Bạn có thể hỏi về booking, khách hàng, gói chụp, thu chi, hóa đơn, ví, ca làm, dự án, nhân sự, thiết bị, thông báo hoặc lịch sử hoạt động.`;
  }
  if (includesAny(lower, ["sdt", "số điện thoại", "so dien thoai", "điện thoại"])) {
    return `${prefix}Số điện thoại studio: ${context.studio.phone}. Số điện thoại tài khoản hiện tại: ${context.currentUser.phone}.`;
  }
  if (includesAny(lower, ["địa chỉ", "dia chi", "address"])) return `${prefix}Địa chỉ studio: ${context.studio.address}.`;
  if (includesAny(lower, ["email", "mail"])) return `${prefix}Email studio: ${context.studio.email}. Email tài khoản hiện tại: ${context.currentUser.email}.`;
  if (includesAny(lower, ["tên studio", "studio tên", "thông tin studio"])) {
    return `${prefix}Studio hiện tại là ${context.studio.name}. SĐT: ${context.studio.phone}. Địa chỉ: ${context.studio.address}.`;
  }
  if (includesAny(lower, ["tôi là ai", "tài khoản", "trang cá nhân", "vai trò"])) {
    return `${prefix}Bạn đang đăng nhập bằng tài khoản ${context.currentUser.name ?? "chưa cập nhật"}, vai trò ${context.currentUser.roleLabel}, email ${context.currentUser.email}.`;
  }
  if (includesAny(lower, ["tổng quan", "thống kê", "bao nhiêu dữ liệu", "dữ liệu studio"])) {
    if (!context.canViewFinance) {
      return `${prefix}Tổng quan studio: ${context.counts.bookings} booking, ${context.counts.customers} khách, ${context.counts.packages} gói, ${context.counts.categories} danh mục, ${context.counts.projects} dự án, ${context.counts.employees} nhân sự, ${context.counts.equipment} thiết bị. Mình đã ẩn toàn bộ số liệu tiền bạc vì tài khoản hiện tại là Nhân viên nha.`;
    }
    return `${prefix}Tổng quan studio: ${context.counts.bookings} booking, ${context.counts.customers} khách, ${context.counts.packages} gói, ${context.counts.categories} danh mục, ${context.counts.projects} dự án, ${context.counts.invoices} hóa đơn, ${context.counts.incomeTransactions} khoản thu, ${context.counts.expenseTransactions} khoản chi, ${context.counts.employees} nhân sự, ${context.counts.equipment} thiết bị.`;
  }
  if (includesAny(lower, ["doanh thu", "lợi nhuận", "thu chi", "công nợ", "hóa đơn", "ví", "tiền", "ca"])) {
    if (!context.canViewFinance) return `${prefix}${financeAccessDeniedAnswer()}`;
    if (includesAny(lower, ["hôm nay", "today", "nay"])) {
      return `${prefix}Hôm nay thu ${money(context.finance.todayIncome)}, chi ${money(context.finance.todayExpense)}, tạm tính còn ${money(context.finance.todayProfit)}.`;
    }
    if (includesAny(lower, ["công nợ", "nợ", "chưa thanh toán"])) {
      return `${prefix}Công nợ hiện còn ${money(context.finance.totalDebt)} từ ${context.finance.unpaidInvoiceCount} hóa đơn:\n${listOrEmpty(context.finance.invoices.filter((item) => toNumber(item.due) > 0), (item, index) => `${index + 1}. ${item.code} - ${item.customer?.name ?? "khách chưa gắn"} - còn ${money(item.due)}`)}`;
    }
    if (includesAny(lower, ["ca", "mở ca", "đóng ca", "sổ ca"])) {
      return `${prefix}Ca đang mở (${context.finance.openShifts.length} ca):\n${listOrEmpty(context.finance.openShifts, (item, index) => `${index + 1}. ${item.code ?? "chưa có mã"} - mở lúc ${dateText(item.openedAt)} - thu ${money(item.totalIncome)} - chi ${money(item.totalExpense)} - dự kiến ${money(item.expectedClosingBalance)}`)}`;
    }
    return `${prefix}Tháng này thu ${money(context.finance.monthIncome)}, chi ${money(context.finance.monthExpense)}, lợi nhuận tạm tính ${money(context.finance.monthProfit)}. Công nợ hiện còn ${money(context.finance.totalDebt)} từ ${context.finance.unpaidInvoiceCount} hóa đơn.`;
  }
  if (includesAny(lower, ["booking hôm nay", "lịch hôm nay", "hôm nay có lịch"])) {
    return `${prefix}Booking hôm nay (${context.bookings.today.length} lịch):\n${listOrEmpty(context.bookings.today, (item, index) => `${index + 1}. ${item.customerName || item.title} - ${item.packageName || item.package?.name || "chưa có gói"} - ${dateText(item.startAt)} - ${statusLabel(item.status)}`)}`;
  }
  if (includesAny(lower, ["booking", "lịch", "lịch hẹn"])) {
    return `${prefix}Booking sắp tới (${context.bookings.upcoming.length} lịch trong 30 ngày tới):\n${listOrEmpty(context.bookings.upcoming, (item, index) => `${index + 1}. ${item.customerName || item.title} - ${item.packageName || item.package?.name || "chưa có gói"} - ${dateText(item.startAt)} - ${statusLabel(item.status)}`)}`;
  }
  if (includesAny(lower, ["khách", "khách hàng"])) {
    return `${prefix}Khách hàng nổi bật:\n${listOrEmpty(context.customers, (item, index) => `${index + 1}. ${item.name}${item.phone ? ` - ${item.phone}` : ""}${context.canViewFinance ? ` - đã chi ${money(item.totalSpent)}` : ""}`)}`;
  }
  if (includesAny(lower, ["gói", "dịch vụ", "concept", "danh mục"])) {
    return `${prefix}Gói chụp hiện có:\n${listOrEmpty(context.packages, (item, index) => `${index + 1}. ${item.name} - ${item.category?.name ?? "chưa có danh mục"} - ${money(item.price)}`)}`;
  }
  if (includesAny(lower, ["dự án", "project"])) {
    return `${prefix}Dự án gần đây:\n${listOrEmpty(context.projects, (item, index) => `${index + 1}. ${item.code} - ${item.name} - ${statusLabel(item.status)}${context.canViewFinance ? ` - còn nợ ${money(item.dueAmount)}` : ""}`)}`;
  }
  if (includesAny(lower, ["thiết bị", "máy ảnh", "đèn", "lens"])) {
    return `${prefix}Thiết bị cần chú ý: ${context.counts.equipmentNeedsAttention}/${context.counts.equipment} thiết bị.\n${listOrEmpty(context.equipment, (item, index) => `${index + 1}. ${item.name} - ${item.type} - ${statusLabel(item.status)}${item.assignedTo ? ` - giao cho ${item.assignedTo}` : ""}`)}`;
  }
  if (includesAny(lower, ["nhân sự", "nhân viên", "staff"])) {
    return `${prefix}Nhân sự:\n${listOrEmpty(context.employees, (item, index) => `${index + 1}. ${item.name} - ${item.position}${item.phone ? ` - ${item.phone}` : ""}`)}`;
  }
  if (includesAny(lower, ["thông báo", "nhắc"])) {
    return `${prefix}Thông báo chưa đọc: ${context.counts.notificationsUnread}. Thông báo gần đây:\n${listOrEmpty(context.notifications, (item, index) => `${index + 1}. ${item.title} - ${item.isRead ? "đã đọc" : "chưa đọc"}${item.dueAt ? ` - nhắc lúc ${dateText(item.dueAt)}` : ""}`)}`;
  }
  if (includesAny(lower, ["lịch sử", "nhật ký", "ai đã làm gì", "hoạt động"])) {
    return `${prefix}Hoạt động gần đây:\n${listOrEmpty(context.auditLogs, (item, index) => `${index + 1}. ${item.user?.name ?? "Hệ thống"} - ${actionLabel(item.action, item.entity)} - ${dateText(item.createdAt)}`)}`;
  }

  return `${prefix}Mình đã đồng bộ dữ liệu studio hiện tại. Bạn hỏi cụ thể hơn một chút, ví dụ: "hôm nay có booking nào", "tháng này thu chi sao", "khách nào chi nhiều", "ca nào đang mở", "thiết bị nào đang bận" để mình trả lời đúng hơn.`;
}

function contextForModel(context: StudioAIContext) {
  const financeText = context.canViewFinance
    ? `
Tài chính hôm nay: thu ${money(context.finance.todayIncome)}, chi ${money(context.finance.todayExpense)}, lợi nhuận tạm tính ${money(context.finance.todayProfit)}.
Tài chính tháng này: thu ${money(context.finance.monthIncome)}, chi ${money(context.finance.monthExpense)}, lợi nhuận tạm tính ${money(context.finance.monthProfit)}, doanh thu booking hoàn tất ${money(context.finance.completedBookingRevenueThisMonth)}, công nợ ${money(context.finance.totalDebt)} từ ${context.finance.unpaidInvoiceCount} hóa đơn.
Ví:
${listOrEmpty(context.finance.wallets, (item, index) => `${index + 1}. ${item.name} - ${item.type} - số dư ${money(item.balance)} - số dư đầu kỳ ${money(item.openingBalance)}${item.isActive ? " - đang dùng" : ""}`)}
Ca đang mở:
${listOrEmpty(context.finance.openShifts, (item, index) => `${index + 1}. ${item.code ?? "chưa có mã"} - mở bởi ${item.openedBy?.name ?? "chưa rõ"} - mở lúc ${dateText(item.openedAt)} - đầu kỳ ${money(item.openingBalance)} - thu ${money(item.totalIncome)} - chi ${money(item.totalExpense)} - dự kiến ${money(item.expectedClosingBalance)}`)}
Ca đã đóng gần đây:
${listOrEmpty(context.finance.recentClosedShifts, (item, index) => `${index + 1}. ${item.code ?? "chưa có mã"} - đóng bởi ${item.closedBy?.name ?? "chưa rõ"} - đóng lúc ${dateText(item.closedAt)} - hệ thống ${money(item.expectedClosingBalance)} - thực tế ${money(item.actualClosingBalance)} - lệch ${money(item.difference)}`)}
Hóa đơn còn nợ:
${listOrEmpty(context.finance.invoices.filter((item) => toNumber(item.due) > 0), (item, index) => `${index + 1}. ${item.code} - ${item.customer?.name ?? "khách chưa gắn"} - tổng ${money(item.total)} - đã trả ${money(item.paid)} - còn ${money(item.due)} - ${statusLabel(item.status)}`)}
Thu chi gần đây:
${listOrEmpty(context.finance.transactions, (item, index) => `${index + 1}. ${item.title} - ${item.type === "INCOME" ? "khoản thu" : "khoản chi"} - ${money(item.amount)} - ${dateText(item.occurredAt)} - ví ${item.wallet?.name ?? "chưa gắn ví"} - duyệt ${statusLabel(item.approvalStatus)}${item.note ? ` - ghi chú ${item.note}` : ""}`, 14)}`
    : "Tài chính: bị ẩn vì người dùng hiện tại là nhân viên.";

  return `
Thời điểm đồng bộ: ${dateText(context.now)}.
Vai trò người hỏi: ${context.currentUser.roleLabel}.
Studio: ${context.studio.name}; SĐT ${context.studio.phone}; email ${context.studio.email}; địa chỉ ${context.studio.address}; tiền tệ ${context.studio.currency}.
Người dùng hiện tại: ${context.currentUser.name}; email ${context.currentUser.email}; SĐT ${context.currentUser.phone}; trạng thái ${context.currentUser.status}.

Số lượng dữ liệu: ${context.counts.categories} danh mục, ${context.counts.packages} gói, ${context.counts.bookings} booking, ${context.counts.bookingsToday} booking hôm nay, ${context.counts.bookingsUpcoming} booking sắp tới, ${context.counts.bookingsCompleted} booking hoàn tất, ${context.counts.customers} khách, ${context.counts.projects} dự án, ${context.counts.projectsOpen} dự án đang làm, ${context.canViewFinance ? `${context.counts.invoices} hóa đơn, ${context.counts.invoicesUnpaid} hóa đơn còn nợ, ${context.counts.incomeTransactions} khoản thu, ${context.counts.expenseTransactions} khoản chi, ${context.counts.wallets} ví, ${context.counts.openShifts} ca đang mở, ` : "số liệu tài chính đã ẩn theo quyền, "}${context.counts.employees} nhân sự, ${context.counts.equipment} thiết bị, ${context.counts.equipmentNeedsAttention} thiết bị cần chú ý, ${context.counts.notificationsUnread} thông báo chưa đọc, ${context.counts.auditLogs} hoạt động đã ghi nhận.

Bộ nhớ AI đã học:
${listOrEmpty(context.aiMemories, (item, index) => `${index + 1}. ${item.value}`, 12)}

Tìm kiếm sâu theo câu hỏi:
Lý do: ${context.deepSearch.reason}
Từ khóa: ${context.deepSearch.tokens.join(", ") || "không có"}
Booking khớp câu hỏi:
${listOrEmpty(context.deepSearch.matchedBookings, (item, index) => `${index + 1}. ${item.customerName || item.customer?.name || item.title} - gói ${item.packageName || item.package?.name || "chưa có gói"} - ngày ${dateText(item.startAt)} - trạng thái ${statusLabel(item.status)} - ảnh ${hasMedia(item) ? "đã có" : "chưa có"}`, 14)}
Booking chưa có ảnh:
${listOrEmpty(context.deepSearch.missingImageBookings, (item, index) => `${index + 1}. ${item.customerName || item.customer?.name || item.title} - gói ${item.packageName || item.package?.name || "chưa có gói"} - ngày ${dateText(item.startAt)} - trạng thái ${statusLabel(item.status)}`, 14)}
Khách khớp câu hỏi:
${listOrEmpty(context.deepSearch.matchedCustomers, (item, index) => `${index + 1}. ${item.name} - SĐT ${item.phone ?? "chưa có"} - email ${item.email ?? "chưa có"} - ghi chú ${item.note ?? "không có"}`, 10)}
${context.canViewFinance ? `Thu chi khớp câu hỏi:\n${listOrEmpty(context.deepSearch.matchedTransactions, (item, index) => `${index + 1}. ${item.title} - ${item.type === "INCOME" ? "khoản thu" : "khoản chi"} - ${money(item.amount)} - ${dateText(item.occurredAt)} - ví ${item.wallet?.name ?? "chưa gắn ví"}`, 10)}` : "Thu chi khớp câu hỏi: đã ẩn theo quyền."}

${financeText}

Booking hôm nay:
${listOrEmpty(context.bookings.today, (item, index) => `${index + 1}. ${item.customerName || item.title} - ${item.packageName || item.package?.name || "chưa có gói"} - ${dateText(item.startAt)} - ${statusLabel(item.status)} - tổng ${money(item.total ?? item.price)}`)}
Booking sắp tới trong 30 ngày:
${listOrEmpty(context.bookings.upcoming, (item, index) => `${index + 1}. ${item.customerName || item.title} - ${item.packageName || item.package?.name || "chưa có gói"} - ${dateText(item.startAt)} - ${statusLabel(item.status)} - phòng ${item.studioRoom ?? "chưa gắn"}`, 12)}
Booking cập nhật gần đây:
${listOrEmpty(context.bookings.recent, (item, index) => `${index + 1}. ${item.customerName || item.title} - ${item.packageName || item.package?.name || "chưa có gói"} - ${dateText(item.startAt)} - ${statusLabel(item.status)}`, 10)}
Booking hoàn tất tháng này:
${listOrEmpty(context.bookings.completedThisMonth, (item, index) => `${index + 1}. ${item.customerName || item.title} - ${item.packageName || item.package?.name || "chưa có gói"} - ${dateText(item.startAt)} - tổng ${money(item.total ?? item.price)}`)}

Khách hàng nổi bật:
${listOrEmpty(context.customers, (item, index) => `${index + 1}. ${item.name}; SĐT ${item.phone ?? "chưa có"}; email ${item.email ?? "chưa có"}; nguồn ${item.source ?? "chưa có"}; tổng chi ${context.canViewFinance ? money(item.totalSpent) : "ẩn theo quyền"}; ghi chú ${item.note ?? "không có"}`, 12)}
Danh mục: ${context.categories.map((item) => item.name).join(", ") || "chưa có dữ liệu"}.
Gói chụp:
${listOrEmpty(context.packages, (item, index) => `${index + 1}. ${item.name} - danh mục ${item.category?.name ?? "chưa có"} - giá ${money(item.price)} - thời lượng ${item.duration ?? "chưa nhập"} - số người ${item.peopleCount ?? "linh hoạt"} - địa điểm ${item.location ?? "chưa nhập"}`, 14)}
Dự án:
${listOrEmpty(context.projects, (item, index) => `${index + 1}. ${item.code} - ${item.name} - khách ${item.customer?.name ?? "chưa gắn"} - ${statusLabel(item.status)} - deadline ${dateText(item.deadlineAt)} - còn nợ ${context.canViewFinance ? money(item.dueAmount) : "ẩn theo quyền"}`, 12)}
Nhân sự:
${listOrEmpty(context.employees, (item, index) => `${index + 1}. ${item.name} - ${item.position} - SĐT ${item.phone ?? "chưa có"} - lịch ${item.workSchedule ?? "chưa nhập"}`)}
Thiết bị:
${listOrEmpty(context.equipment, (item, index) => `${index + 1}. ${item.name} - ${item.type} - serial ${item.serial ?? "chưa có"} - ${statusLabel(item.status)} - giao cho ${item.assignedTo ?? "chưa giao"}${item.maintenance[0]?.nextDueAt ? ` - bảo trì tiếp ${dateText(item.maintenance[0].nextDueAt)}` : ""}`, 12)}
Thông báo:
${listOrEmpty(context.notifications, (item, index) => `${index + 1}. ${item.title} - ${item.message} - ${item.isRead ? "đã đọc" : "chưa đọc"} - nhắc lúc ${item.dueAt ? dateText(item.dueAt) : "không có"}`, 10)}
Lịch sử hoạt động gần đây:
${listOrEmpty(context.auditLogs, (item, index) => `${index + 1}. ${item.user?.name ?? "Hệ thống"} (${roleLabel(item.user?.role?.name)}) - ${actionLabel(item.action, item.entity)} - ${dateText(item.createdAt)}`, 12)}
`.trim();
}
