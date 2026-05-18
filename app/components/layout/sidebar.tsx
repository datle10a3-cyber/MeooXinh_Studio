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

import {
  STUDIO_AVATAR_URL,
  STUDIO_DISPLAY_NAME,
  StudioCatMark,
} from "@/app/components/brand/studio-brand";

import { useUiStore } from "@/app/store/ui-store";
import type { CurrentSession } from "@/app/types/auth";
import { cn } from "@/app/utils/cn";
import { studioViewPath } from "@/app/utils/studio-navigation";
import { isRootAdminSession } from "@/app/utils/root-admin";

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
      {
        id: "categories",
        label: "Danh mục",
        icon: FolderOpen,
        href: "/categories",
      },

      {
        id: "packages",
        label: "Gói",
        icon: Package,
        href: "/packages",
      },

      {
        id: "booking",
        label: "Booking",
        icon: CalendarDays,
      },
      {
        id: "projects",
        label: "Dự án",
        icon: BriefcaseBusiness,
      },
    ],
  },

  {
    title: "Tài chính",
    items: [
      {
        id: "transactions",
        label: "Thu chi",
        icon: BadgeDollarSign,
      },

      {
        id: "wallets",
        label: "Ví",
        icon: WalletCards,
      },

      {
        id: "invoices",
        label: "Hóa đơn",
        icon: FileText,
      },

      {
        id: "reports",
        label: "Báo cáo",
        icon: ChartNoAxesCombined,
        adminOnly: true,
      },
    ],
  },

  {
    title: "Quản lý",
    items: [
      {
        id: "customers",
        label: "Khách",
        icon: Users,
      },

      {
        id: "completed-bookings",
        label: "Booking hoàn tất",
        icon: CheckCircle2,
        href: "/completed-bookings",
      },

      {
        id: "users",
        label: "Nhân sự",
        icon: Users,
        adminOnly: true,
      },

      {
        id: "equipment",
        label: "Thiết bị",
        icon: Camera,
      },

      {
        id: "notifications",
        label: "Thông báo",
        icon: Bell,
      },

      {
        id: "trash",
        label: "Thùng rác",
        icon: Trash2,
        adminOnly: true,
      },
    ],
  },
];
const rootAdminNavItem: NavItem = {
  id: "root-admins",
  label: "Admin",
  icon: ShieldCheck,
  href: "/root-admins",
};

export const Sidebar = memo(function Sidebar({ session }: { session: CurrentSession | null }) {
  const pathname = usePathname();
  const router = useRouter();

  const setActiveResource = useUiStore((state) => state.setActiveResource);

  const role = session?.user.role;
  const visibleNavGroups = isRootAdminSession(session)
    ? navGroups.map((group) => group.title === "Quản lý" || group.title === "Quáº£n lĂ½" ? { ...group, items: [...group.items, rootAdminNavItem] } : group)
    : navGroups;

  function classes(active: boolean) {
    return cn(
      "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold transition-all duration-200",
      active
        ? "bg-white text-[#5B342C] shadow-[0_4px_12px_rgba(184,95,108,0.08)] ring-1 ring-[#F4C7C4]/50"
        : "text-[#9B746B] hover:bg-white/40 hover:text-[#5B342C]",
    );
  }

  return (
    <aside className="hidden w-64 shrink-0 border-r border-[#F4C7C4]/50 bg-white/50 px-4 py-6 xl:block">
      <div className="mb-6 rounded-[2rem] border-2 border-[#F7AFC0] bg-white p-5 text-[#5B342C] shadow-[0_8px_20px_rgba(184,95,108,0.06)]">
        <StudioCatMark compact />

        <p className="mt-3 rounded-full bg-white px-3 py-2 text-center text-xs font-black text-[#74443A]">
          make & photo
        </p>
      </div>

      {session ? (
        <div className="mb-5 flex items-center gap-3 rounded-[1.4rem] border border-[#F4C7C4] bg-white p-3 shadow-sm">
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#EA7188] font-black text-white">
            {session.user.avatarUrl || STUDIO_AVATAR_URL ? (
              <img
                src={session.user.avatarUrl || STUDIO_AVATAR_URL}
                alt={session.user.name || STUDIO_DISPLAY_NAME}
                className="h-full w-full object-cover"
              />
            ) : (
              (session.user.name?.[0]?.toUpperCase() ?? "B")
            )}
          </div>

          <div className="min-w-0">
            <p className="whitespace-normal break-words text-sm font-black leading-5 text-[#5B342C]">
              {session.user.name}
            </p>

            <p className="whitespace-normal break-words text-xs font-semibold leading-4 text-[#9B746B]">
              {session.user.email}
            </p>
          </div>
        </div>
      ) : null}

      <nav className="space-y-4">
        {visibleNavGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-2 text-xs font-black uppercase tracking-wide text-[#C17D8A]">
              {group.title}
            </p>

            <div className="space-y-1">
              {group.items
                .filter(
                  (item) =>
                    !item.adminOnly || role === "ADMIN" || role === "MANAGER",
                )
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
                        router.push(targetHref, { scroll: false });
                      }}
                      className={classes(active)}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-5 border-t border-[#F4C7C4] pt-4">
        <Button variant="ghost" className="w-full justify-start">
          <Settings size={18} />
          Cài đặt
        </Button>
      </div>
    </aside>
  );
});
