import { prisma } from "@/app/lib/prisma";
import type { SessionUser } from "@/app/lib/auth";

export function actorRoleLabel(role: SessionUser["role"] | string) {
  if (role === "ADMIN") return "Quản trị viên";
  if (role === "MANAGER") return "Quản lý";
  return "Nhân viên";
}

export function auditActionLabel(action: string) {
  const key = action.toUpperCase();
  if (key.includes("FINALIZE_BOOKING")) return "Hoàn tất";
  if (key.includes("CREATE")) return "Thêm";
  if (key.includes("UPDATE")) return "Sửa";
  if (key.includes("DELETE")) return "Xóa vĩnh viễn";
  if (key.includes("TRASH")) return "Chuyển vào thùng rác";
  if (key.includes("RESTORE")) return "Khôi phục";
  if (key.includes("UPLOAD")) return "Tải ảnh lên";
  if (key.includes("OPEN_SHIFT")) return "Mở ca";
  if (key.includes("CLOSE_SHIFT")) return "Đóng ca";
  if (key.includes("READ")) return "Đánh dấu đã đọc";
  if (key.includes("LOGIN")) return "Đăng nhập";
  if (key.includes("LOGOUT")) return "Đăng xuất";
  if (key.includes("PASSWORD")) return "Đổi mật khẩu";
  return "Thao tác";
}

export function auditEntityLabel(entity: string) {
  const key = entity.toLowerCase();
  if (key.includes("category")) return "danh mục";
  if (key.includes("package")) return "gói chụp";
  if (key.includes("booking")) return "booking";
  if (key.includes("customer")) return "khách hàng";
  if (key.includes("transaction")) return "thu chi";
  if (key.includes("invoice")) return "hóa đơn";
  if (key.includes("project")) return "dự án";
  if (key.includes("employee") || key.includes("user")) return "nhân sự";
  if (key.includes("equipment")) return "thiết bị";
  if (key.includes("notification")) return "thông báo";
  if (key.includes("walletshift")) return "ca ví";
  if (key.includes("wallet")) return "ví";
  if (key.includes("media")) return "thư viện ảnh";
  if (key.includes("studio")) return "studio";
  if (key.includes("profile")) return "trang cá nhân";
  if (key.includes("auth")) return "tài khoản";
  return "dữ liệu";
}

export async function writeAuditLog(
  user: SessionUser,
  action: string,
  entity: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  const nextMetadata = {
    ...(metadata ?? {}),
    actionLabel: auditActionLabel(action),
    entityLabel: auditEntityLabel(entity),
    actorName: user.name,
    actorRole: user.role,
    actorRoleLabel: actorRoleLabel(user.role),
  };

  await prisma.auditLog.create({
    data: {
      studioId: user.studioId,
      userId: user.id,
      action,
      entity,
      entityId,
      metadata: JSON.stringify(nextMetadata),
    },
  });
}
