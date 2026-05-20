"use client";

import { memo, startTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  Bell,
  Bot,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarDays,
  Camera,
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
  X,
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
      { id: "ai", label: "AI", icon: Bot },
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

type Props = {
  open: boolean;
  onClose: () => void;
  session: CurrentSession | null;
  rootAdminTheme?: boolean;
};

/**
 * TabletMenu — lightweight slide-in panel for tablet/iPad (768px–1279px).
 *
 * ALWAYS mounted in the DOM — visibility toggled via CSS transform only.
 * No mount/unmount, no backdrop-blur, no body scroll lock.
 * Only uses `transition-transform` (cheap GPU layer) — NOT transition-all.
 */
export const TabletMenu = memo(function TabletMenu({ open, onClose, session, rootAdminTheme = false }: Props) {
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

  function goTo(item: NavItem) {
    const target = item.href || studioViewPath(item.id);
    // Close immediately, no delay. Then navigate in startTransition.
    onClose();
    startTransition(() => {
      setActiveResource(item.id);
      router.push(target, { scroll: true });
    });
  }

  function isActive(item: NavItem) {
    return pathname === (item.href || studioViewPath(item.id));
  }

  return (
    <>
      {/*
        Tap-outside overlay — only a transparent hit area, no blur/backdrop.
        Thin z-index below panel so taps close the menu.
        Hidden on mobile (<md) and desktop (xl+).
      */}
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 hidden md:block xl:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
        onClick={onClose}
      />

      {/*
        Panel — always in DOM, position:fixed left side.
        Toggle via translate-x only (GPU composited, no layout recalc).
        No backdrop-filter, no box-shadow blur, no overflow on body.
      */}
      <aside
        className={cn(
          // Layout
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto",
          // Only visible on tablet range
          "hidden md:flex xl:hidden",
          // GPU layer — transform-only transition, will-change avoids paint
          "will-change-transform transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
          // Theme
          rootAdminTheme
            ? "border-r border-emerald-300/15 bg-[#04110A]"
            : "border-r border-[#F4C7C4] bg-[#FFF7F0]"
        )}
      >
        {/* Header row */}
        <div className={cn("flex items-center justify-between border-b p-3", rootAdminTheme ? "border-emerald-300/15" : "border-[#F4C7C4]")}>
          {rootAdminTheme ? (
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-100">
                <ShieldCheck size={18} />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Root</p>
                <p className="text-base font-black text-white">Super Admin</p>
              </div>
            </div>
          ) : (
            <StudioCatMark />
          )}
          <Button
            variant="secondary"
            size="icon"
            aria-label="Đóng menu"
            onClick={onClose}
            className={cn(rootAdminTheme ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "")}
          >
            <X size={18} />
          </Button>
        </div>

        {/* User info */}
        {session ? (
          <div className={cn("flex items-center gap-3 border-b px-3 py-2.5", rootAdminTheme ? "border-emerald-300/15" : "border-[#F4C7C4]")}>
            <div className={cn("grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl font-black text-white", rootAdminTheme ? "border border-emerald-300/25 bg-emerald-400/10 text-emerald-100" : "bg-[#EA7188]")}>
              {rootAdminTheme ? (
                <ShieldCheck size={16} />
              ) : session.user.avatarUrl || STUDIO_AVATAR_URL ? (
                <img src={session.user.avatarUrl || STUDIO_AVATAR_URL} alt={session.user.name || STUDIO_DISPLAY_NAME} className="h-full w-full object-cover" />
              ) : (
                (session.user.name?.[0]?.toUpperCase() ?? "B")
              )}
            </div>
            <div className="min-w-0">
              <p className={cn("truncate text-sm font-black", rootAdminTheme ? "text-white" : "text-[#5B342C]")}>
                {rootAdminTheme ? "Super Admin" : session.user.name}
              </p>
              <p className={cn("truncate text-xs font-semibold", rootAdminTheme ? "text-slate-400" : "text-[#9B746B]")}>
                {session.user.email}
              </p>
            </div>
          </div>
        ) : null}

        {/* Nav groups */}
        <div className="flex-1 space-y-3 overflow-y-auto p-3 pb-[max(env(safe-area-inset-bottom),2rem)]">
          {visibleNavGroups.map((group) => (
            <section key={group.title}>
              <p className={cn("mb-1.5 px-1 text-xs font-black uppercase tracking-wide", rootAdminTheme ? "text-emerald-300/70" : "text-[#C87888]")}>
                {group.title}
              </p>
              <div className="grid gap-1">
                {group.items
                  .filter((item) => !item.adminOnly || role === "ADMIN" || role === "MANAGER")
                  .map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-2xl px-3 text-left text-sm font-black",
                          // No transition-all — only specific props
                          "transition-colors duration-150",
                          rootAdminTheme
                            ? active
                              ? "border border-emerald-300/25 bg-emerald-400/12 text-emerald-100"
                              : "text-slate-400 hover:bg-emerald-400/8 hover:text-emerald-100"
                            : active
                              ? "border border-[#F4C7C4] bg-white text-[#5B342C]"
                              : "text-[#9B746B] hover:bg-white/60 hover:text-[#5B342C]"
                        )}
                        onClick={() => goTo(item)}
                      >
                        <Icon size={18} className="shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className={cn("border-t p-3", rootAdminTheme ? "border-emerald-300/15" : "border-[#F4C7C4]")}>
          <Button
            variant="ghost"
            className={cn("w-full justify-start", rootAdminTheme ? "text-slate-400 hover:bg-emerald-400/8 hover:text-emerald-100" : "")}
            aria-label="Cài đặt"
          >
            <Settings size={18} />
            <span className="ml-3">Cài đặt</span>
          </Button>
        </div>
      </aside>
    </>
  );
});
