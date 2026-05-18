import { fail, ok, serverError } from "@/app/lib/api-response";
import { isRootAdmin, requireUser } from "@/app/lib/auth";
import { rootSystemSettingsSummary, updateDefaultShiftPassword, updateRegistrationInviteCode } from "@/app/lib/system-settings";

export async function GET() {
  try {
    const user = await requireUser();
    if (!isRootAdmin(user)) return fail("Chỉ admin chính được xem cấu hình hệ thống.", 403);
    return ok(await rootSystemSettingsSummary());
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Bạn chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    if (!isRootAdmin(user)) return fail("Chỉ admin chính được sửa cấu hình hệ thống.", 403);

    const body = await req.json().catch(() => ({}));
    const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";
    const shiftPassword = typeof body.shiftPassword === "string" ? body.shiftPassword.trim() : "";

    if (inviteCode) {
      if (inviteCode.length < 6) return fail("Mã mời cần ít nhất 6 ký tự.", 422);
      await updateRegistrationInviteCode(inviteCode);
    }

    if (shiftPassword) {
      if (!/^\d{6}$/.test(shiftPassword)) return fail("Mật khẩu xóa ca phải gồm đúng 6 số.", 422);
      await updateDefaultShiftPassword(shiftPassword);
    }

    return ok(await rootSystemSettingsSummary());
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Bạn chưa đăng nhập.", 401);
    return serverError(error);
  }
}
