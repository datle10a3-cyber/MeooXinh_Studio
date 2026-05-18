import { fail, ok, created, serverError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { requireUser, verifyPassword } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { verifyDefaultShiftPassword } from "@/app/lib/system-settings";

type ShiftRow = Record<string, unknown>;

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

async function calculateShiftTotals(studioId: string, walletId: string, from: Date, to = new Date()) {
  const transactions = await prisma.transaction.findMany({
    where: {
      studioId,
      walletId,
      deletedAt: null,
      approvalStatus: "APPROVED",
      occurredAt: { gte: from, lte: to },
    },
    select: { type: true, amount: true },
  });

  const totalIncome = transactions
    .filter((item) => item.type === "INCOME")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const totalExpense = transactions
    .filter((item) => item.type === "EXPENSE")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  return { totalIncome, totalExpense };
}

async function enrichOpenShift(shift: ShiftRow | null) {
  if (!shift) return null;
  const { totalIncome, totalExpense } = await calculateShiftTotals(
    String(shift.studioId),
    String(shift.walletId),
    new Date(String(shift.openedAt)),
  );
  const expectedClosingBalance = toNumber(shift.openingBalance) + totalIncome - totalExpense;
  return { ...shift, totalIncome, totalExpense, expectedClosingBalance, difference: 0 };
}

async function nextShiftCode(studioId: string) {
  const shifts = await prisma.walletShift.findMany({
    where: { studioId, code: { startsWith: "CA-MEOXINH-" } },
    select: { code: true },
  });
  let max = 0;
  shifts.forEach((shift) => {
    const match = /^CA-MEOXINH-(\d+)$/i.exec(String(shift.code ?? ""));
    if (match) {
      const num = Number(match[1]);
      if (num > max) max = num;
    }
  });
  return `CA-MEOXINH-${String(max + 1).padStart(3, "0")}`;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const walletId = url.searchParams.get("walletId");
    if (!walletId) return fail("Thiếu ví cần xem ca.", 422);

    const [wallet, openShift, shifts] = await Promise.all([
      prisma.wallet.findFirst({ where: { id: walletId, studioId: user.studioId, deletedAt: null } }),
      prisma.walletShift.findFirst({
        where: { studioId: user.studioId, walletId, status: "OPEN" },
        orderBy: { openedAt: "desc" },
        include: { openedBy: true, closedBy: true },
      }),
      prisma.walletShift.findMany({
        where: { studioId: user.studioId, walletId },
        orderBy: { openedAt: "desc" },
        take: 30,
        include: { openedBy: true, closedBy: true },
      }),
    ]);

    if (!wallet) return fail("Không tìm thấy ví.", 404);

    return ok({
      openShift: await enrichOpenShift(openShift as ShiftRow | null),
      shifts,
      nextCode: await nextShiftCode(user.studioId),
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const walletId = String(body.walletId ?? "");
    if (!walletId) return fail("Thiếu ví để mở ca.", 422);

    const wallet = await prisma.wallet.findFirst({ where: { id: walletId, studioId: user.studioId, deletedAt: null } });
    if (!wallet) return fail("Không tìm thấy ví.", 404);

    const existed = await prisma.walletShift.findFirst({
      where: { studioId: user.studioId, walletId, status: "OPEN" },
    });
    if (existed) return fail("Ví này đang có ca mở. Vui lòng đóng ca hiện tại trước.", 409);

    const openingBalance = body.openingBalance !== undefined && body.openingBalance !== "" ? Number(body.openingBalance) : Number(wallet.balance);
    const openedAt = new Date();
    const code = await nextShiftCode(user.studioId);
    const shift = await prisma.walletShift.create({
      data: {
        studioId: user.studioId,
        walletId,
        code,
        openedById: user.id,
        openingBalance,
        expectedClosingBalance: openingBalance,
        note: body.note ? String(body.note) : null,
        openedAt,
      },
      include: { openedBy: true, closedBy: true },
    });

    await writeAuditLog(user, "OPEN_SHIFT", "WalletShift", shift.id, { name: `${code} - ${wallet.name}`, code, walletName: wallet.name, openingBalance });
    return created(await enrichOpenShift(shift as ShiftRow));
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const shiftId = String(body.shiftId ?? "");
    if (!shiftId) return fail("Thiếu ca cần đóng.", 422);

    const current = await prisma.walletShift.findFirst({
      where: { id: shiftId, studioId: user.studioId, status: "OPEN" },
    });
    if (!current) return fail("Không tìm thấy ca đang mở.", 404);

    const closedAt = new Date();
    const { totalIncome, totalExpense } = await calculateShiftTotals(user.studioId, current.walletId, current.openedAt, closedAt);
    const expectedClosingBalance = Number(current.openingBalance) + totalIncome - totalExpense;
    const actualClosingBalance = body.actualClosingBalance !== undefined && body.actualClosingBalance !== "" ? Number(body.actualClosingBalance) : expectedClosingBalance;
    const difference = actualClosingBalance - expectedClosingBalance;

    const shift = await prisma.$transaction(async (tx) => {
      await tx.transaction.updateMany({
        where: {
          studioId: user.studioId,
          walletId: current.walletId,
          deletedAt: null,
          walletShiftId: null,
          occurredAt: { gte: current.openedAt, lte: closedAt },
        },
        data: { walletShiftId: current.id },
      });
      return tx.walletShift.update({
        where: { id: shiftId },
        data: {
          status: "CLOSED",
          closedById: user.id,
          totalIncome,
          totalExpense,
          expectedClosingBalance,
          actualClosingBalance,
          difference,
          closeNote: body.closeNote ? String(body.closeNote) : null,
          closedAt,
        },
        include: { openedBy: true, closedBy: true },
      });
    });

    await writeAuditLog(user, "CLOSE_SHIFT", "WalletShift", shift.id, {
      name: shift.code ?? "ca làm việc",
      code: shift.code,
      totalIncome,
      totalExpense,
      expectedClosingBalance,
      actualClosingBalance,
      difference,
    });
    return ok(shift);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return fail("Chỉ quản trị viên mới được xóa ca.", 403);

    const body = await req.json().catch(() => ({}));
    const shiftId = String(body.shiftId ?? "");
    const password = String(body.password ?? "");
    if (!shiftId) return fail("Thiếu ca cần xóa.", 422);
    if (!/^\d{6}$/.test(password)) return fail("Mật khẩu studio phải gồm 6 số.", 422);

    const [studio, shift] = await Promise.all([
      prisma.studio.findUnique({ where: { id: user.studioId }, select: { shiftPasswordHash: true } }),
      prisma.walletShift.findFirst({ where: { id: shiftId, studioId: user.studioId, status: "CLOSED" } }),
    ]);

    if (!shift) return fail("Không tìm thấy ca đã đóng.", 404);
    const validPassword = studio?.shiftPasswordHash
      ? await verifyPassword(password, studio.shiftPasswordHash)
      : await verifyDefaultShiftPassword(password);
    if (!validPassword) return fail("Mật khẩu studio không đúng.", 401);

    await prisma.walletShift.delete({ where: { id: shiftId } });
    await writeAuditLog(user, "DELETE", "WalletShift", shiftId, { name: "ca làm việc" });
    return ok({ deleted: true });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
