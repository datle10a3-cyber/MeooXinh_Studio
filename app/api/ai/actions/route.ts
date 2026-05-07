import { fail, ok, serverError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { canViewStudioFinance } from "@/app/lib/ai-studio";
import { requireUser } from "@/app/lib/auth";
import { applyTransactionWalletDelta, finalizeCompletedBooking } from "@/app/lib/finance-workflow";
import { prisma } from "@/app/lib/prisma";

function parsePayload(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function openShiftForTransaction(studioId: string, walletId: string, occurredAt: Date) {
  return prisma.walletShift.findFirst({
    where: { studioId, walletId, status: "OPEN", openedAt: { lte: occurredAt } },
    orderBy: { openedAt: "desc" },
    select: { id: true },
  });
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!canViewStudioFinance(user.role)) return ok([]);
    const rows = await prisma.aiActionSuggestion.findMany({
      where: { studioId: user.studioId, userId: user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    return ok(rows.map((row) => ({ ...row, payload: parsePayload(row.payload) })));
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!canViewStudioFinance(user.role)) return fail("Chỉ Quản trị viên hoặc Quản lý mới được xác nhận đề xuất AI.", 403);
    const body = (await req.json().catch(() => ({}))) as { id?: string; decision?: "APPROVE" | "REJECT" };
    if (!body.id) return fail("Thiếu mã đề xuất.", 422);

    const suggestion = await prisma.aiActionSuggestion.findFirst({
      where: { id: body.id, studioId: user.studioId, status: "PENDING" },
    });
    if (!suggestion) return fail("Không tìm thấy đề xuất đang chờ duyệt.", 404);

    if (body.decision === "REJECT") {
      const row = await prisma.aiActionSuggestion.update({
        where: { id: suggestion.id },
        data: { status: "REJECTED", decidedAt: new Date(), result: "Đã bỏ qua đề xuất." },
      });
      return ok({ ...row, payload: parsePayload(row.payload) });
    }

    const payload = parsePayload(suggestion.payload);
    let result = "";

    if (suggestion.type === "OPEN_VIEW") {
      result = "Đề xuất chỉ dùng để mở đúng màn hình xử lý, không thay đổi dữ liệu.";
    } else if (suggestion.type === "CREATE_TRANSACTION") {
      const walletId = String(payload.walletId ?? "");
      const type = String(payload.type ?? "");
      const amount = Number(payload.amount ?? 0);
      const title = String(payload.title ?? "").trim();
      if (!walletId || !["INCOME", "EXPENSE"].includes(type) || !amount || amount <= 0 || !title) {
        return fail("Đề xuất thu chi thiếu thông tin, không thể xác nhận.", 422);
      }
      const wallet = await prisma.wallet.findFirst({ where: { id: walletId, studioId: user.studioId, deletedAt: null } });
      if (!wallet) return fail("Ví trong đề xuất không còn tồn tại.", 404);
      const occurredAt = payload.occurredAt ? new Date(String(payload.occurredAt)) : new Date();
      const shift = await openShiftForTransaction(user.studioId, wallet.id, occurredAt);
      const row = await prisma.transaction.create({
        data: {
          studioId: user.studioId,
          walletId: wallet.id,
          walletShiftId: shift?.id ?? null,
          type,
          title,
          amount,
          method: String(payload.method ?? wallet.type ?? "CASH"),
          approvalStatus: "APPROVED",
          occurredAt,
          note: String(payload.note ?? "Tạo từ đề xuất AI."),
        },
      });
      await applyTransactionWalletDelta(row, 1);
      await writeAuditLog(user, "CREATE", "Transaction", row.id, { name: title, source: "AI_ACTION" });
      result = `Đã tạo ${type === "INCOME" ? "khoản thu" : "khoản chi"} ${amount.toLocaleString("vi-VN")} đ.`;
    } else if (suggestion.type === "UPDATE_BOOKING_STATUS") {
      const bookingId = String(payload.bookingId ?? "");
      const status = String(payload.status ?? "");
      if (!bookingId || !["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(status)) {
        return fail("Đề xuất booking thiếu thông tin, không thể xác nhận.", 422);
      }
      const currentBooking = await prisma.booking.findFirst({ where: { id: bookingId, studioId: user.studioId, deletedAt: null } });
      if (!currentBooking) return fail("Booking không thuộc studio hiện tại hoặc đã bị xóa.", 404);
      const booking = await prisma.booking.update({
        where: { id: currentBooking.id },
        data: { status },
        include: { customer: true, package: true },
      });
      if (status === "COMPLETED") await finalizeCompletedBooking(booking, user);
      await writeAuditLog(user, "UPDATE", "Booking", booking.id, { name: booking.customerName ?? booking.title, source: "AI_ACTION" });
      result = `Đã cập nhật booking sang trạng thái ${status}.`;
    } else {
      return fail("Loại đề xuất AI chưa được hỗ trợ.", 422);
    }

    const row = await prisma.aiActionSuggestion.update({
      where: { id: suggestion.id },
      data: { status: "APPROVED", decidedAt: new Date(), result },
    });
    return ok({ ...row, payload: parsePayload(row.payload) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
