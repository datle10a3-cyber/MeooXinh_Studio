"use client";

import { memo, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  Bell,
  Bot,
  BriefcaseBusiness,
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
  Trash2,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
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
  onNavigate: (item: NavItem) => void;
  session: CurrentSession | null;
  rootAdminTheme?: boolean;
};

/**
 * TabletMenu — dropdown panel for tablet/iPad (768px–1279px).
 *
 * NOT a drawer. NOT a fixed full-screen overlay.
 * This is an absolutely-positioned card that drops down from the header area.
 *
 * Design constraints:
 * - No fixed inset-0 overlay (causes full-page repaint)
 * - No translate-x/translate-y animation (causes GPU compositor jank)
 * - No backdrop-blur / dim overlay on content
 * - No body scroll lock
 * - Renders only when open (simple conditional mount — it's tiny, no perf cost)
 * - Click outside closes via document pointerdown listener (zero DOM cost)
 * - Navigation: calls onNavigate which closes menu FIRST, then routes
 */
export const TabletMenu = memo(function TabletMenu({
  open,
  onClose,
  onNavigate,
  session,
  rootAdminTheme = false,
}: Props) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const role = session?.user.role;
  const rootAdminCentralOnly = isRootAdminSession(session) && !isViewingAsAdmin(session);
  const visibleNavGroups = isRootAdminSession(session)
    ? rootAdminCentralOnly
      ? [{ title: "Quản lý", items: [rootAdminNavItem] }]
      : navGroups.map((group) =>
          group.title === "Quản lý"
            ? { ...group, items: [...group.items, rootAdminNavItem] }
            : group
        )
    : navGroups;

  // Close on tap outside panel
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay to avoid catching the same tap that opened the menu
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDown, { passive: true });
    }, 30);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open, onClose]);

  function isActive(item: NavItem) {
    return pathname === (item.href || studioViewPath(item.id));
  }

  // Don't render when closed — this is a lightweight menu, mount/unmount is cheap
  if (!open) return null;

  return (
    // Absolutely positioned dropdown from top-left, NOT fixed full-screen.
    // z-50 to sit above content but below modals.
    // hidden md:block xl:hidden ensures tablet-only.
    <div
      ref={panelRef}
      className={cn(
        // Position: absolute to parent (header area), not fixed to viewport
        "fixed left-2 top-[calc(env(safe-area-inset-top)+3.5rem)] z-50",
        // Tablet range only
        "hidden md:block xl:hidden",
        // Card style — no animation, no transform, just appear
        "w-72 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl shadow-[0_12px_40px_rgba(91,52,44,0.18)]",
        rootAdminTheme
          ? "border border-emerald-300/20 bg-[#0A1F12]"
          : "border border-[#F4C7C4] bg-[#FFF7F0]"
      )}
    >
      {/* Close button row */}
      <div className={cn("flex items-center justify-between border-b p-2.5", rootAdminTheme ? "border-emerald-300/15" : "border-[#F4C7C4]")}>
        <p className={cn("text-xs font-black uppercase tracking-wide", rootAdminTheme ? "text-emerald-300/70" : "text-[#C87888]")}>
          Menu
        </p>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Đóng menu"
          onClick={onClose}
          className={cn("h-8 w-8", rootAdminTheme ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "")}
        >
          <X size={16} />
        </Button>
      </div>

      {/* Nav items — compact grid */}
      <div className="space-y-2 p-2.5">
        {visibleNavGroups.map((group) => (
          <section key={group.title}>
            <p className={cn("mb-1 px-1 text-[10px] font-black uppercase tracking-widest", rootAdminTheme ? "text-emerald-300/50" : "text-[#C87888]/70")}>
              {group.title}
            </p>
            <div className="grid gap-0.5">
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
                        "flex min-h-[2.5rem] items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-bold",
                        "transition-colors duration-100",
                        rootAdminTheme
                          ? active
                            ? "bg-emerald-400/15 font-black text-emerald-100"
                            : "text-slate-400 active:bg-emerald-400/10"
                          : active
                            ? "bg-white font-black text-[#5B342C] shadow-sm"
                            : "text-[#9B746B] active:bg-white/60"
                      )}
                      onClick={() => onNavigate(item)}
                    >
                      <Icon size={16} className="shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
});

// Re-export NavItem type for app-shell
export type { NavItem };
