"use client";

import dynamic from "next/dynamic";
import type React from "react";
import { useCallback, useEffect, useState, startTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  Bot,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarDays,
  Download,
  FileText,
  FolderOpen,
  Home,
  LayoutDashboard,
  Menu,
  Moon,
  Package,
  Search,
  Settings,
  Sun,
  Trash2,
  Users,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { STUDIO_AVATAR_URL, STUDIO_DISPLAY_NAME, StudioCatMark } from "@/app/components/brand/studio-brand";
import { useUiStore } from "@/app/store/ui-store";
import type { CurrentSession } from "@/app/types/auth";
import { studioViewPath } from "@/app/utils/studio-navigation";

const Sidebar = dynamic(
  () =>
    import("@/app/components/layout/sidebar").then(
      (mod) => mod.Sidebar,
    ),
  { ssr: false },
);

const UserMenu = dynamic(
  () =>
    import("@/app/components/layout/user-menu").then(
      (mod) => mod.UserMenu,
    ),
  { ssr: false },
);

const NotificationBell = dynamic(
  () =>
    import("@/app/components/notifications/notification-bell").then(
      (mod) => mod.NotificationBell,
    ),
  { ssr: false },
);

type NavItem = {
  id: string;
  label: string;
  href?: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
};

type SearchResult = {
  id: string;
  type?: string;
  label: string;
  title: string;
  subtitle: string;
  targetResource: string;
  targetPath: string;
  transactionView?: "income" | "expense";
};

const devSession: CurrentSession = {
  user: {
    id: "dev-user",
    studioId: "dev-studio",
    role: "ADMIN",
    name: STUDIO_DISPLAY_NAME,
    email: "studio@bemeo.local",
    avatarUrl: STUDIO_AVATAR_URL,
  },
  studio: {
    id: "dev-studio",
    name: STUDIO_DISPLAY_NAME,
    slug: "dev-studio",
    currency: "VND",
  },
};

const mobilePrimary: NavItem[] = [
  { id: "home", label: "Trang chủ", href: "/", icon: Home },
  { id: "wallets", label: "Ví tiền", href: "/wallets", icon: WalletCards },
];

const mobileGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "Chính",
    items: [
      { id: "home", label: "Home", href: "/", icon: Home },
      { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { id: "ai", label: "AI", href: "/ai", icon: Bot },
    ],
  },
  {
    title: "Booking",
    items: [
      { id: "categories", label: "Danh mục", href: "/categories", icon: FolderOpen },
      { id: "packages", label: "Gói", href: "/packages", icon: Package },
      { id: "booking", label: "Booking", href: "/booking", icon: CalendarDays },
      { id: "projects", label: "Dự án", href: "/projects", icon: BriefcaseBusiness },
    ],
  },
  {
    title: "Tài chính",
    items: [
      { id: "transactions", label: "Thu chi", href: "/transactions", icon: BadgeDollarSign },
      { id: "wallets", label: "Ví", href: "/wallets", icon: WalletCards },
      { id: "invoices", label: "Hóa đơn", href: "/invoices", icon: FileText },
      { id: "reports", label: "Báo cáo", href: "/reports", icon: Download },
    ],
  },
  {
    title: "Quản lý",
    items: [
      { id: "customers", label: "Khách", href: "/customers", icon: Users },
      { id: "users", label: "Nhân sự", href: "/users", icon: Users },
      { id: "completed-bookings", label: "Booking hoàn tất", href: "/completed-bookings", icon: CalendarCheck2 },
      { id: "equipment", label: "Thiết bị", href: "/equipment", icon: Wrench },
      { id: "notifications", label: "Thông báo", href: "/notifications", icon: Settings },
      { id: "trash", label: "Thùng rác", href: "/trash", icon: Trash2 },
    ],
  },
];

function isDevBypassHost() {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS !== "true") return false;
  const host = window.location.hostname;
  return host === "127.0.0.1" || host === "localhost";
}

function displayStudioName(session: CurrentSession | null) {
  const name = session?.studio?.name?.trim();
  if (!name || name === "thuthao_studio" || name === "dev-studio") return STUDIO_DISPLAY_NAME;
  return name;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const setActiveResource = useUiStore((state) => state.setActiveResource);
  const darkMode = useUiStore((state) => state.darkMode);
  const setDarkMode = useUiStore((state) => state.setDarkMode);

  const session = useUiStore((state) => state.session);
  const setSession = useUiStore((state) => state.setSession);
  const setFocusedItemId = useUiStore((state) => state.setFocusedItemId);
  const setTransactionViewIntent = useUiStore((state) => state.setTransactionViewIntent);
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFrom, setSearchFrom] = useState("");
  const [searchTo, setSearchTo] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Sync session from localStorage instantly on client render
  useEffect(() => {
    const timers: number[] = [];
    const defer = (callback: () => void) => {
      const timer = window.setTimeout(callback, 0);
      timers.push(timer);
    };

    if (pathname === "/login" || pathname === "/register" || pathname === "/forgot-password") {
      defer(() => setSessionLoading(false));
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }
    try {
      const cached = localStorage.getItem("studio-session");
      if (cached) {
        const parsed = JSON.parse(cached);
        defer(() => {
          setSession(parsed);
          setSessionLoading(false);
        });
      }
    } catch (err) {
      console.error("Local session sync error:", err);
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [pathname, setSession]);

  const loadSession = useCallback(async () => {
    if (pathname === "/login" || pathname === "/register" || pathname === "/forgot-password") {
      setSessionLoading(false);
      return;
    }
    try {
      const cached = localStorage.getItem("studio-session");
      let currentSession = session;
      if (cached && !currentSession) {
        currentSession = JSON.parse(cached);
        setSession(currentSession);
        setSessionLoading(false);
      }
      let res = await fetchWithTimeout("/api/auth/me", { credentials: "include" });
      if (res.status === 401) {
        const refreshed = await fetchWithTimeout("/api/auth/refresh", { method: "POST", credentials: "include" });
        if (refreshed.ok) {
          res = await fetchWithTimeout("/api/auth/me", { credentials: "include" });
        } else {
          setSession(null);
          localStorage.removeItem("studio-session");
          setSessionLoading(false);
          return;
        }
      }
      if (!res.ok) {
        if (isDevBypassHost()) setSession(devSession);
        setSessionLoading(false);
        return;
      }
      const result = await res.json().catch(() => null);
      if (result?.data) {
        setSession(result.data);
        localStorage.setItem("studio-session", JSON.stringify(result.data));
      } else {
        setSession(null);
        localStorage.removeItem("studio-session");
      }
    } catch (err) {
      console.error("Session load error:", err);
      if (isDevBypassHost()) setSession(devSession);
    } finally {
      setSessionLoading(false);
    }
  }, [session, setSession, pathname]);
  // Sync activeResource với pathname thực tế
  useEffect(() => {
    if (!pathname) return;
    const segments = pathname.split("/").filter(Boolean);
    const view = segments[0] || "home";
    setActiveResource(view);
  }, [pathname, setActiveResource]);

  function goTo(item: NavItem) {
    startTransition(() => {
      setMobileMenuOpen(false);
      const target = item.href || studioViewPath(item.id);
      router.push(target, { scroll: false });
    });
  }

  function goToSearchResult(item: SearchResult) {
    if (item.type === "transactions" && item.transactionView) {
      setTransactionViewIntent(item.transactionView);
    } else {
      setTransactionViewIntent(null);
    }
    setFocusedItemId(item.id);
    setSearchOpen(false);
    setSearchQuery("");
    
    router.push(item.targetPath, { scroll: false });
  }

  function isActive(item: NavItem) {
    const target = item.href || studioViewPath(item.id);
    return pathname === target;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSession(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSession]);

  useEffect(() => {
    if (!searchOpen || searchQuery.trim().length < 3) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const params = new URLSearchParams({ q: searchQuery.trim() });
      if (searchFrom) params.set("from", searchFrom);
      if (searchTo) params.set("to", searchTo);
      const result = await fetch(`/api/search?${params.toString()}`, { signal: controller.signal })
        .then((res) => res.json())
        .catch(() => null);
      setSearching(false);
      setSearchResults(result?.data ?? []);
    }, 500);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchOpen, searchQuery, searchFrom, searchTo]);

  const [hideMobileNav, setHideMobileNav] = useState(false);

  useEffect(() => {
    const checkModalOpen = () => {
      setHideMobileNav(document.body.classList.contains('studio-modal-open'));
    };
    checkModalOpen();
    const observer = new MutationObserver(checkModalOpen);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function updateSession(event: Event) {
      const next = (event as CustomEvent<CurrentSession>).detail;
      if (next) {
        setSession(next);
        try {
          localStorage.setItem("studio-session", JSON.stringify(next));
        } catch {}
      }
    }
    window.addEventListener("studio-session-updated", updateSession);
    return () => window.removeEventListener("studio-session-updated", updateSession);
  }, [setSession]);


  const isAiPage = pathname === "/ai";
  const shouldHideMobileNav = hideMobileNav || isAiPage;

  if (sessionLoading && !session) {
    return (
      <main className="min-h-dvh bg-[#FFF3EC] px-4 py-6 text-[#5B342C]">
        <div className="mx-auto grid min-h-[85dvh] w-full max-w-6xl place-items-center">
          <div className="w-full max-w-md rounded-[2rem] border border-[#F4C7C4] bg-white/80 p-5 shadow-[0_22px_60px_rgba(184,95,108,0.16)]">
            <div className="flex items-center gap-3">
              <StudioCatMark compact />
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-[#EA7188]">Mèoo Xinhh Studio</p>
                <p className="mt-1 text-sm font-semibold text-[#9B746B]">Đang kiểm tra bảo mật...</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-[#FFE1E8]" />
              <div className="h-24 animate-pulse rounded-3xl bg-[#FFF0F4]" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-16 animate-pulse rounded-2xl bg-[#FFF0F4]" />
                <div className="h-16 animate-pulse rounded-2xl bg-[#FFF0F4]" />
                <div className="h-16 animate-pulse rounded-2xl bg-[#FFF0F4]" />
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className={darkMode ? "min-h-dvh bg-[#2B1C1A] text-white" : "min-h-dvh bg-[#FFF3EC] text-[#5B342C]"}>
      <div className="flex min-h-dvh">
        <Sidebar session={session} />
        <main className="min-w-0 flex-1 touch-pan-y">
          <header className="sticky top-0 z-30 border-b border-[#F4C7C4] bg-[#FFF3EC]/95 px-2.5 py-2 backdrop-blur supports-[backdrop-filter]:bg-[#FFF3EC]/86 sm:px-4 lg:py-3 xl:px-8" style={{ transform: "translateZ(0)" }}>
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <Button
                   variant="secondary"
                  size="icon"
                  className="h-11 w-11 shrink-0 touch-manipulation rounded-2xl border-2 border-[#F4A7B9] bg-white text-[#5B342C] shadow-[0_8px_20px_rgba(184,95,108,0.18)] transition active:scale-95 sm:h-[3.25rem] sm:w-[3.25rem] xl:hidden"
                  aria-label="Mở menu"
                  onClick={() => setMobileMenuOpen(true)}
                >
                  <Menu size={24} strokeWidth={2.8} />
                </Button>
                <div className="min-w-0">
                  <p className="line-clamp-1 text-xs font-black leading-4 text-[#E88498] sm:text-sm">
                    Studio: {displayStudioName(session)}
                  </p>
                  <h2 className="hidden whitespace-nowrap text-base font-black leading-5 text-[#5B342C] sm:block sm:text-lg">Booking, finance, CRM</h2>
                </div>
              </div>

              <div className="flex min-w-0 shrink-0 items-center justify-end gap-1 sm:gap-2">
                <div className="hidden items-center gap-2 rounded-2xl border border-[#F4C7C4] bg-white px-2 py-1 shadow-sm xl:flex">
                  <Link scroll={false} className="rounded-xl px-3 py-2 text-sm font-black text-[#5B342C] hover:bg-[#FFF0F4]" href="/categories">
                    Danh mục
                  </Link>
                  <Link scroll={false} className="rounded-xl px-3 py-2 text-sm font-black text-[#5B342C] hover:bg-[#FFF0F4]" href="/packages">
                    Gói
                  </Link>
                  <Link scroll={false} className="rounded-xl px-3 py-2 text-sm font-black text-[#5B342C] hover:bg-[#FFF0F4]" href="/booking">
                    Booking
                  </Link>
                </div>
                {session?.user.role !== "STAFF" ? (
                  <a className="hidden h-11 items-center gap-2 rounded-2xl border border-[#F4C7C4] bg-white px-4 text-sm font-black text-[#5B342C] shadow-sm hover:bg-[#FFF0F4] xl:flex" href="/api/reports?type=transactions">
                    <Download size={16} />
                    CSV
                  </a>
                ) : null}
                <button
                  className="hidden h-11 items-center gap-2 rounded-2xl bg-[#EA7188] px-4 text-white shadow-sm transition hover:bg-[#DA5E79] xl:flex"
                  onClick={() => goTo({ id: "ai", label: "AI", icon: Bot })}
                >
                  <Bot size={17} />
                  <span className="text-sm font-black">AI</span>
                </button>
                <button
                  type="button"
                  className="hidden h-11 items-center gap-2 rounded-2xl border border-[#F4C7C4] bg-white px-4 text-[#9B746B] shadow-sm transition hover:bg-[#FFF0F4] xl:flex"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search size={17} />
                  <span className="text-sm font-semibold">Tìm kiếm...</span>
                </button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="grid h-10 w-10 rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl xl:hidden"
                  aria-label="Tìm kiếm"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search size={17} />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="grid h-10 w-10 rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl"
                  aria-label={darkMode ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
                  onClick={() => setDarkMode(!darkMode)}
                >
                  {darkMode ? <Sun size={17} /> : <Moon size={17} />}
                </Button>
                {session ? <NotificationBell /> : null}
                <UserMenu session={session} onLogout={() => setSession(null)} />
              </div>
            </div>
          </header>

          <div className="studio-ios-scroll studio-mobile-bottom-safe px-2.5 py-3 sm:px-4 sm:py-5 lg:pb-6 xl:px-8">{children}</div>
        </main>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden" style={{ transform: "translateZ(0)" }}>
          <button className="absolute inset-0 bg-[#2B1C1A]/35" style={{ backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} aria-label="Đóng menu" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-dvh w-[88vw] max-w-[360px] flex-col overflow-hidden border-r border-[#F4C7C4] bg-[#FFF7F0] pt-[env(safe-area-inset-top)] shadow-2xl sm:w-[380px] sm:max-w-md" style={{ transform: "translate3d(0,0,0)", willChange: "transform" }}>
            <div className="flex items-center justify-between border-b border-[#F4C7C4] p-3 sm:p-4">
              <StudioCatMark compact />
              <Button variant="secondary" size="icon" aria-label="Đóng menu" onClick={() => setMobileMenuOpen(false)}>
                <X size={18} />
              </Button>
            </div>
            <div className="studio-ios-scroll flex-1 space-y-4 overflow-y-auto p-3 pb-[max(env(safe-area-inset-bottom),2rem)] sm:p-4">
              {mobileGroups.map((group) => (
                <section key={group.title}>
                  <p className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-[#C87888]">{group.title}</p>
                  <div className="grid gap-2">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={`${group.title}-${item.id}`}
                          className={`flex min-h-11 items-center gap-3 rounded-2xl px-3 text-left text-sm font-black transition sm:min-h-12 sm:px-4 ${
                            isActive(item)
                              ? "border border-[#F4C7C4] bg-white text-[#5B342C] shadow-sm"
                              : "text-[#9B746B] hover:bg-white/80 hover:text-[#5B342C]"
                          }`}
                          onClick={() => goTo(item)}
                        >
                          <Icon size={19} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </aside>
        </div>
      ) : null}

      {searchOpen ? (
        <div className="fixed inset-0 z-[90] bg-[#2B1C1A]/35 p-3 backdrop-blur-sm" onClick={() => setSearchOpen(false)}>
          <div className="mx-auto mt-16 w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-[#F4C7C4] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-[#F4C7C4] px-4 py-3">
              <Search size={19} className="text-[#EA7188]" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Tìm khách, booking, hóa đơn, thu chi..."
                className="h-10 min-w-0 flex-1 bg-transparent text-sm font-bold text-[#5B342C] outline-none placeholder:text-[#B98278]"
              />
              <Button variant="secondary" size="icon" aria-label="Đóng tìm kiếm" onClick={() => setSearchOpen(false)}>
                <X size={16} />
              </Button>
            </div>
            <div className="grid gap-2 border-b border-[#F4C7C4] px-4 py-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="text-xs font-black uppercase text-[#B98278]">
                Từ ngày
                <input type="date" value={searchFrom} onChange={(event) => setSearchFrom(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#F4C7C4] bg-[#FFF9F4] px-3 text-sm normal-case text-[#5B342C]" />
              </label>
              <label className="text-xs font-black uppercase text-[#B98278]">
                Đến ngày
                <input type="date" value={searchTo} onChange={(event) => setSearchTo(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#F4C7C4] bg-[#FFF9F4] px-3 text-sm normal-case text-[#5B342C]" />
              </label>
              {(searchFrom || searchTo) ? (
                <Button variant="ghost" className="self-end" onClick={() => { setSearchFrom(""); setSearchTo(""); }}>
                  Xóa lọc
                </Button>
              ) : null}
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {searchQuery.trim().length < 2 ? (
                <p className="px-3 py-8 text-center text-sm font-bold text-[#9B746B]">Nhập ít nhất 2 ký tự để tìm toàn bộ studio.</p>
              ) : searching ? (
                <p className="px-3 py-8 text-center text-sm font-bold text-[#9B746B]">Đang tìm...</p>
              ) : searchResults.length ? (
                <div className="grid gap-2">
                  {searchResults.map((item) => (
                    <button
                      key={`${item.label}-${item.id}`}
                      type="button"
                      className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[#FFF3EC]"
                      onClick={() => goToSearchResult(item)}
                    >
                      <span className="min-w-0">
                        <span className="mb-1 inline-flex rounded-full bg-[#FFF0F4] px-2 py-0.5 text-[11px] font-black text-[#A84E61]">{item.label}</span>
                        <span className="block whitespace-normal break-words text-sm font-black text-[#5B342C]">{item.title}</span>
                        <span className="block whitespace-normal break-words text-xs font-semibold text-[#9B746B]">{item.subtitle}</span>
                      </span>
                      <span className="shrink-0 text-xs font-black text-[#EA7188]">Mở</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-3 py-8 text-center text-sm font-bold text-[#9B746B]">Không có kết quả phù hợp.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <nav className={`fixed inset-x-0 bottom-0 z-40 border-t border-[#F4C7C4]/60 bg-[#FFF3EC]/60 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg supports-[backdrop-filter]:bg-[#FFF3EC]/40 transition-all duration-300 ease-in-out xl:hidden ${shouldHideMobileNav ? 'hidden' : ''}`} style={{ transform: "translateZ(0)" }}>
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-around px-8">
          {mobilePrimary.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <button
                key={item.id}
                className={`group relative flex h-full flex-1 flex-col items-center justify-center transition-all active:scale-95`}
                onClick={() => goTo(item)}
              >
                <div className={`flex flex-col items-center gap-0.5 transition-colors ${active ? "text-[#EA7188]" : "text-[#9B746B] group-hover:text-[#5B342C]"}`}>
                  <Icon size={20} strokeWidth={active ? 2.8 : 2} />
                  <span className="text-[10px] font-black uppercase tracking-tighter">{item.label}</span>
                </div>
                {active && (
                  <div className="absolute -bottom-[2px] h-1 w-6 rounded-full bg-[#EA7188] shadow-[0_0_8px_rgba(234,113,136,0.5)]" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
