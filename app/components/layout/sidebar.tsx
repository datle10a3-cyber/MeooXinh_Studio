"use client";

import { memo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  ChartNoAxesCombined,
  CheckCircle2,
  FileText,
  FolderOpen,
  Home,
  LayoutDashboard,
  Package,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { STUDIO_AVATAR_URL, STUDIO_DISPLAY_NAME, StudioCatMark } from "@/app/components/brand/studio-brand";
import { useUiStore } from "@/app/store/ui-store";
import type { CurrentSession } from "@/app/types/auth";
import { cn } from "@/app/utils/cn";
import { studioViewPath } from "@/app/utils/studio-navigation";
import { isRootAdminSession, isViewingAsAdmin } from "@/app/utils/root-admin";

type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  adminOnly?: boolean;
};

const navGroups: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Chính",
    items: [
      { id: "home", label: "Home", icon: Home },
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "ai", label: "AI", icon: Sparkles },
    ],
  },
  {
    title: "Booking",
    items: [
      { id: "categories", label: "Danh mục", icon: FolderOpen, href: "/categories" },
      { id: "packages", label: "Gói", icon: Package, href: "/packages" },
      { id: "booking", label: "Booking", icon: CalendarDays },
      { id: "projects", label: "Dự án", icon: BriefcaseBusiness },
    ],
  },
  {
    title: "Tài chính",
    items: [
      { id: "transactions", label: "Thu chi", icon: BadgeDollarSign },
      { id: "wallets", label: "Ví", icon: WalletCards },
      { id: "invoices", label: "Hóa đơn", icon: FileText },
      { id: "reports", label: "Báo cáo", icon: ChartNoAxesCombined, adminOnly: true },
    ],
  },
  {
    title: "Quản lý",
    items: [
      { id: "customers", label: "Khách", icon: Users },
      { id: "completed-bookings", label: "Booking hoàn tất", icon: CheckCircle2, href: "/completed-bookings" },
      { id: "users", label: "Nhân sự", icon: Users, adminOnly: true },
      { id: "equipment", label: "Thiết bị", icon: Camera },
      { id: "notifications", label: "Thông báo", icon: Bell },
      { id: "trash", label: "Thùng rác", icon: Trash2, adminOnly: true },
    ],
  },
];

const rootAdminNavItem: NavItem = {
  id: "root-admins",
  label: "Admin",
  icon: ShieldCheck,
  href: "/root-admins",
};

export const Sidebar = memo(function Sidebar({ session, rootAdminTheme = false, collapsed = false }: { session: CurrentSession | null; rootAdminTheme?: boolean; collapsed?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const setActiveResource = useUiStore((state) => state.setActiveResource);
  const role = session?.user.role;
  const rootAdminCentralOnly = isRootAdminSession(session) && !isViewingAsAdmin(session);
  const visibleNavGroups = isRootAdminSession(session)
    ? rootAdminCentralOnly
      ? [{ title: "Quản lý", items: [rootAdminNavItem] }]
      : navGroups.map((group) => group.title === "Quản lý" ? { ...group, items: [...group.items, rootAdminNavItem] } : group)
    : navGroups;

  function classes(active: boolean) {
    if (rootAdminTheme) {
      return cn(
        "flex h-10 w-full items-center rounded-xl font-bold transition-all duration-200",
        collapsed ? "justify-center px-0 lg:justify-start lg:gap-3 lg:px-3 lg:text-left lg:text-sm" : "gap-3 px-3 text-left text-sm",
        active ? "bg-emerald-400/12 text-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.10)] ring-1 ring-emerald-300/25" : "text-slate-400 hover:bg-emerald-400/8 hover:text-emerald-100",
      );
    }
    return cn(
      "flex h-10 w-full items-center rounded-xl font-bold transition-all duration-200",
      collapsed ? "justify-center px-0 lg:justify-start lg:gap-3 lg:px-3 lg:text-left lg:text-sm" : "gap-3 px-3 text-left text-sm",
      active ? "bg-white text-[#5B342C] shadow-[0_4px_12px_rgba(184,95,108,0.08)] ring-1 ring-[#F4C7C4]/50" : "text-[#9B746B] hover:bg-white/40 hover:text-[#5B342C]",
    );
  }

  return (
    <aside className={cn("studio-sidebar hidden md:flex flex-col shrink-0 py-6 transition-[width] duration-150 ease-out", collapsed ? "w-20 items-center px-2 lg:w-56 lg:items-start lg:px-3 xl:w-64 xl:px-4" : "w-56 xl:w-64 items-start px-3 xl:px-4", rootAdminTheme ? "border-r border-emerald-300/15 bg-[#04110A]" : "border-r border-[#F4C7C4]/50 bg-white/50")}>
      <div className={cn("mb-6 rounded-[2rem] shadow-[0_8px_20px_rgba(184,95,108,0.06)]", collapsed ? "p-2 bg-transparent border-0 lg:p-5 lg:border-2 lg:border-[#F7AFC0] lg:bg-white lg:text-[#5B342C]" : "p-5 border-2 border-[#F7AFC0] bg-white text-[#5B342C]", rootAdminTheme && !collapsed ? "border border-emerald-300/20 bg-[#06140D] text-slate-100 shadow-[0_18px_50px_rgba(2,6,23,0.28)]" : "")}>
        {rootAdminTheme ? (
          <div className={cn("flex items-center gap-3", collapsed ? "justify-center lg:justify-start" : "")}>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-200">
              <ShieldCheck size={22} />
            </span>
            <div className={cn(collapsed ? "hidden lg:block" : "block")}>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Root</p>
              <p className="text-lg font-black leading-5 text-white">Super Admin</p>
            </div>
          </div>
        ) : (
          <StudioCatMark compact={collapsed} />
        )}

        <p className={cn("mt-3 rounded-full px-3 py-2 text-center text-xs font-black", collapsed ? "hidden lg:block" : "block", rootAdminTheme ? "bg-emerald-400/10 text-emerald-100 ring-1 ring-emerald-300/15" : "bg-white text-[#74443A]")}>
          {rootAdminTheme ? "quản lý chính" : "make & photo"}
        </p>
      </div>

      {session ? (
        <div className={cn("mb-5 flex items-center gap-3 rounded-[1.4rem] border shadow-sm", collapsed ? "p-1.5 bg-transparent border-transparent lg:p-3 lg:bg-white lg:border-[#F4C7C4]" : "p-3 bg-white border-[#F4C7C4]", rootAdminTheme && !collapsed ? "border-emerald-300/15 bg-[#06140D] text-slate-100" : "")}>
          <div className={cn("grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl font-black text-white", rootAdminTheme ? "border border-emerald-300/25 bg-emerald-400/10 text-emerald-100" : "bg-[#EA7188]")}>
            {rootAdminTheme ? (
              <ShieldCheck size={18} />
            ) : session.user.avatarUrl || STUDIO_AVATAR_URL ? (
              <img src={session.user.avatarUrl || STUDIO_AVATAR_URL} alt={session.user.name || STUDIO_DISPLAY_NAME} className="h-full w-full object-cover" />
            ) : (
              (session.user.name?.[0]?.toUpperCase() ?? "B")
            )}
          </div>

          <div className={cn("min-w-0", collapsed ? "hidden lg:block" : "block")}>
            <p className={cn("whitespace-normal break-words text-sm font-black leading-5", rootAdminTheme ? "text-white" : "text-[#5B342C]")}>
              {rootAdminTheme ? "Super Admin" : session.user.name}
            </p>
            <p className={cn("whitespace-normal break-words text-xs font-semibold leading-4", rootAdminTheme ? "text-slate-400" : "text-[#9B746B]")}>
              {session.user.email}
            </p>
          </div>
        </div>
      ) : null}

      <nav className="w-full space-y-4">
        {visibleNavGroups.map((group) => (
          <div key={group.title} className={cn("w-full", collapsed ? "flex flex-col items-center lg:items-stretch" : "")}>
            <p className={cn("mb-2 px-2 text-xs font-black uppercase tracking-wide", collapsed ? "hidden lg:block" : "block", rootAdminTheme ? "text-slate-500" : "text-[#C17D8A]")}>{group.title}</p>
            <div className="w-full space-y-1">
              {group.items
                .filter((item) => !item.adminOnly || role === "ADMIN" || role === "MANAGER")
                .map((item) => {
                  const Icon = item.icon;
                  const targetHref = item.href || studioViewPath(item.id);
                  const active = pathname === targetHref;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveResource(item.id);
                        router.push(targetHref, { scroll: true });
                      }}
                      className={classes(active)}
                    >
                      <Icon size={18} className="shrink-0" />
                      <span className={cn(collapsed ? "hidden lg:block" : "block")}>{item.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("mt-5 border-t pt-4 w-full", rootAdminTheme ? "border-emerald-300/15" : "border-[#F4C7C4]")}>
        <Button variant="ghost" className={cn("w-full", collapsed ? "justify-center px-0 lg:justify-start lg:px-3" : "justify-start px-3", rootAdminTheme ? "text-slate-400 hover:bg-emerald-400/8 hover:text-emerald-100" : "")}>
          <Settings size={18} className="shrink-0" />
          <span className={cn(collapsed ? "hidden lg:block" : "block")}>Cài đặt</span>
        </Button>
      </div>
    </aside>
  );
});
