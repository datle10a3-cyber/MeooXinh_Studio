"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CircleDollarSign,
  Package,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/utils/cn";

export type ProfileAuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  actorName?: string | null;
  actorRole?: string | null;
  createdAt: string;
};

type FilterKey = "all" | "booking" | "transaction" | "customer" | "other";

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "booking", label: "Booking" },
  { key: "transaction", label: "Thu chi" },
  { key: "customer", label: "Khách" },
  { key: "other", label: "Khác" },
];

function entityInfo(entity: string): { label: string; icon: LucideIcon; tone: string } {
  const key = entity.toLowerCase();
  if (key.includes("booking")) return { label: "booking", icon: CalendarDays, tone: "bg-[#FFF3EC] text-[#A84E61]" };
  if (key.includes("transaction")) return { label: "thu chi", icon: CircleDollarSign, tone: "bg-amber-50 text-amber-700" };
  if (key.includes("customer")) return { label: "khách hàng", icon: UserRound, tone: "bg-sky-50 text-sky-700" };
  if (key.includes("package")) return { label: "gói chụp", icon: Package, tone: "bg-violet-50 text-violet-700" };
  return { label: "dữ liệu", icon: Activity, tone: "bg-[#FFF3EC] text-[#9B746B]" };
}

function actionText(action: string) {
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
  if (key.includes("PASSWORD")) return "Đổi mật khẩu";
  if (key.includes("LOGIN")) return "Đăng nhập";
  if (key.includes("LOGOUT")) return "Đăng xuất";
  return "Thao tác";
}

function actorRoleLabel(log: ProfileAuditLog) {
  const role = String(log.metadata?.actorRole ?? log.actorRole ?? "").toUpperCase();
  if (role === "ADMIN") return "Quản trị viên";
  if (role === "MANAGER") return "Quản lý";
  if (role === "STAFF") return "Nhân viên";
  return "Quản trị viên";
}

function logTitle(log: ProfileAuditLog) {
  const info = entityInfo(log.entity);
  const action = typeof log.metadata?.actionLabel === "string" ? log.metadata.actionLabel : actionText(log.action);
  const entity = typeof log.metadata?.entityLabel === "string" ? log.metadata.entityLabel : info.label;
  const name = log.metadata?.name ?? log.metadata?.title ?? log.metadata?.customerName;
  const suffix = typeof name === "string" && name.trim() ? ` ${name}` : "";
  return `${actorRoleLabel(log)} đã ${String(action).toLowerCase()} ${entity}${suffix}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function groupLabel(date: Date) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, now)) return "Hôm nay";
  if (isSameDay(date, yesterday)) return "Hôm qua";
  return "Ngày cũ hơn";
}

function relativeTime(value: string) {
  const date = new Date(value);
  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Vừa xong";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hôm qua";
  if (days < 7) return `${days} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

function matchesFilter(log: ProfileAuditLog, filter: FilterKey) {
  if (filter === "all") return true;
  const entity = log.entity.toLowerCase();
  if (filter === "other") return !["booking", "transaction", "customer"].some((key) => entity.includes(key));
  return entity.includes(filter);
}

export function HistoryList({ logs }: { logs: ProfileAuditLog[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [visible, setVisible] = useState(10);

  const matchingLogs = useMemo(() => logs.filter((log) => matchesFilter(log, filter)), [filter, logs]);
  const filtered = useMemo(() => matchingLogs.slice(0, visible), [matchingLogs, visible]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, ProfileAuditLog[]>>((acc, log) => {
      const label = groupLabel(new Date(log.createdAt));
      acc[label] = acc[label] ? [...acc[label], log] : [log];
      return acc;
    }, {});
  }, [filtered]);

  return (
    <div>
      <div className="studio-ios-scroll flex gap-1 overflow-x-auto rounded-2xl bg-[#FFF3EC] p-1">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setFilter(item.key);
              setVisible(10);
            }}
            className={cn(
              "shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition",
              filter === item.key ? "bg-white text-[#5B342C] shadow-sm" : "text-[#9B746B] hover:text-[#5B342C]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="studio-ios-scroll mt-4 max-h-[430px] space-y-5 overflow-y-auto pr-1">
        {filtered.length ? (
          Object.entries(grouped).map(([label, items]) => (
            <div key={label}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9A8E80]">{label}</p>
              <div className="space-y-2">
                {items.map((log) => {
                  const info = entityInfo(log.entity);
                  const Icon = info.icon;
                  return (
                    <article key={log.id} className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-[#FFF3EC]">
                      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-2xl", info.tone)}>
                        <Icon size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-normal break-words text-sm font-bold leading-5 text-[#5B342C]">{logTitle(log)}</p>
                        <p className="text-xs text-[#9B746B]">{relativeTime(log.createdAt)}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl bg-[#FFF3EC] p-6 text-center text-sm font-semibold text-[#9B746B]">
            Chưa có hoạt động phù hợp.
          </div>
        )}
      </div>

      {visible < matchingLogs.length ? (
        <Button variant="secondary" className="mt-4 w-full" onClick={() => setVisible((value) => value + 10)}>
          Xem thêm
        </Button>
      ) : null}
    </div>
  );
}
