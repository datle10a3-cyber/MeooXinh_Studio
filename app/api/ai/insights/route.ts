import { fail, ok, serverError } from "@/app/lib/api-response";
import { requireUser } from "@/app/lib/auth";
import { canViewStudioFinance } from "@/app/lib/ai-studio";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    if (!canViewStudioFinance(user.role)) return fail("Chỉ Quản trị viên hoặc Quản lý mới được xem phân tích doanh thu và tiền bạc.", 403);
    const now = new Date();
    const since = new Date(now);
    since.setMonth(since.getMonth() - 3);

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1);

    const [transactions, nextMonthBookings, unpaidInvoices, openShifts, busyEquipment] = await Promise.all([
      prisma.transaction.findMany({
        where: { studioId: user.studioId, occurredAt: { gte: since }, deletedAt: null, approvalStatus: "APPROVED" },
        select: { type: true, amount: true, occurredAt: true },
      }),
      prisma.booking.findMany({
        where: {
          studioId: user.studioId,
          deletedAt: null,
          startAt: { gte: nextMonthStart, lt: nextMonthEnd },
          status: { notIn: ["CANCELLED", "CANCELED"] },
        },
        select: { total: true, price: true },
      }),
      prisma.invoice.findMany({
        where: { studioId: user.studioId, deletedAt: null, due: { gt: 0 } },
        select: { due: true },
        take: 200,
      }),
      prisma.walletShift.count({ where: { studioId: user.studioId, status: "OPEN" } }),
      prisma.equipment.count({ where: { studioId: user.studioId, deletedAt: null, status: { not: "AVAILABLE" } } }),
    ]);

    const incomeTransactions = transactions.filter((item) => item.type === "INCOME");
    const income = incomeTransactions.reduce((sum, item) => sum + Number(item.amount), 0);
    const expense = transactions.filter((item) => item.type === "EXPENSE").reduce((sum, item) => sum + Number(item.amount), 0);

    const monthlyIncome = new Map<string, number>();
    for (const item of incomeTransactions) {
      const key = `${item.occurredAt.getFullYear()}-${item.occurredAt.getMonth()}`;
      monthlyIncome.set(key, (monthlyIncome.get(key) ?? 0) + Number(item.amount));
    }

    const activeIncomeMonths = Math.max(monthlyIncome.size, 1);
    const monthlyAverageIncome = income / activeIncomeMonths;
    const currentMonthIncome = incomeTransactions
      .filter((item) => item.occurredAt >= currentMonthStart)
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const nextMonthBookingValue = nextMonthBookings.reduce((sum, item) => {
      const total = Number(item.total);
      return sum + (total > 0 ? total : Number(item.price));
    }, 0);
    const projectedRevenue = Math.round(Math.max(monthlyAverageIncome, currentMonthIncome, nextMonthBookingValue) * 1.05);
    const expenseRatio = income > 0 ? Math.round((expense / income) * 100) : 0;
    const unpaidDebt = unpaidInvoices.reduce((sum, item) => sum + Number(item.due), 0);
    const confidence =
      transactions.length >= 20 && monthlyIncome.size >= 3
        ? "Cao"
        : transactions.length >= 5 || monthlyIncome.size >= 2 || nextMonthBookingValue > 0
          ? "Trung bình"
          : "Thấp";

    const suggestions = [
      expenseRatio > 55
        ? "Tỷ lệ chi phí đang cao. Nên rà soát các khoản thuê ngoài, mua đồ, marketing và vận hành."
        : "Biên lợi nhuận đang ổn. Có thể ưu tiên đẩy các gói chụp có doanh thu tốt.",
      nextMonthBookingValue > 0
        ? "Tháng tới đã có booking dự kiến. Nên chuẩn bị nhân sự, thiết bị và nhắc lịch sớm."
        : "Chưa có nhiều booking tháng tới. Nên nhắc khách cũ và lấp lịch trống.",
      unpaidDebt > 0 ? "Có hóa đơn còn nợ. Nên nhắc thanh toán trước khi bàn giao đủ sản phẩm." : "Công nợ đang sạch, tiếp tục giữ quy trình thu tiền rõ ràng.",
      openShifts > 0 ? "Đang có ca ví mở. Khi hết ngày nên chốt ca để số liệu khớp." : "Chưa có ca ví đang mở. Khi bắt đầu bán hàng nên mở ca trước.",
      busyEquipment > 0 ? "Có thiết bị không ở trạng thái sẵn sàng. Nên kiểm tra trước lịch chụp gần nhất." : "Thiết bị đang ổn, chưa có cảnh báo lớn.",
    ];

    return ok({
      prediction: {
        nextMonthRevenue: projectedRevenue,
        confidence,
      },
      suggestions,
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
