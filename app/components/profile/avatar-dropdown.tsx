"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, CalendarPlus, Loader2, LogOut, Moon, Settings, ShieldCheck, Sun, User, type LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { AvatarUser } from "@/app/components/profile/avatar-user";
import { Button } from "@/app/components/ui/button";
import { useUiStore } from "@/app/store/ui-store";
import type { CurrentSession } from "@/app/types/auth";
import { navigateStudioView } from "@/app/utils/studio-navigation";

function roleText(role: string) {
  if (role === "ADMIN") return "ADMIN";
  if (role === "MANAGER") return "MANAGER";
  return "STAFF";
}

export function AvatarDropdown({ session, onLogout, rootAdminTheme = false }: { session: CurrentSession; onLogout: () => void; rootAdminTheme?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { darkMode, setDarkMode, setActiveResource } = useUiStore();

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      onLogout();
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  function go(resource: string) {
    setOpen(false);
    setActiveResource(resource);
    navigateStudioView(router, pathname, resource);
  }

  return (
    <div ref={boxRef} className="relative">
      <button type="button" className="rounded-full transition active:scale-95" onClick={() => setOpen((value) => !value)} aria-label="Má»Ÿ tĂ i khoáº£n">
        {rootAdminTheme ? (
          <span className="grid h-12 w-12 place-items-center rounded-full border border-emerald-300/35 bg-emerald-400/10 text-emerald-100 shadow-[0_0_22px_rgba(52,211,153,0.16)]">
            <ShieldCheck size={20} />
          </span>
        ) : (
          <AvatarUser name={session.user.name} avatarUrl={session.user.avatarUrl} />
        )}
      </button>

      {open ? (
        <div className={rootAdminTheme ? "absolute right-0 top-14 z-50 w-[260px] rounded-xl border border-emerald-300/20 bg-[#06140D] p-3 text-slate-100 shadow-2xl" : "absolute right-0 top-14 z-50 w-[260px] rounded-xl border border-[#F4C7C4] bg-white p-3 shadow-xl"}>
          <div className={rootAdminTheme ? "flex items-center gap-3 rounded-xl bg-emerald-400/10 p-3 ring-1 ring-emerald-300/15" : "flex items-center gap-3 rounded-xl bg-[#FFF3EC] p-3"}>
            {rootAdminTheme ? (
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-300/25 bg-[#020617] text-emerald-100">
                <ShieldCheck size={18} />
              </span>
            ) : (
              <AvatarUser name={session.user.name} avatarUrl={session.user.avatarUrl} size="lg" />
            )}
            <div className="min-w-0">
              <p className={rootAdminTheme ? "whitespace-normal break-words text-sm font-bold leading-5 text-white" : "whitespace-normal break-words text-sm font-bold leading-5 text-[#5B342C]"}>
                {rootAdminTheme ? "Super Admin" : session.user.name}
              </p>
              <span className={rootAdminTheme ? "mt-1 inline-flex items-center gap-1 rounded-full bg-[#020617] px-2 py-1 text-[11px] font-bold text-emerald-100" : "mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#9B746B]"}>
                <ShieldCheck size={12} />
                {roleText(session.user.role)}
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <MenuButton icon={User} label="Trang cĂ¡ nhĂ¢n" onClick={() => go("profile")} rootAdminTheme={rootAdminTheme} />
            <MenuButton icon={Building2} label="ThĂ´ng tin studio" onClick={() => go("home")} rootAdminTheme={rootAdminTheme} />
            <MenuButton icon={Settings} label="CĂ i Ä‘áº·t" onClick={() => go("home")} rootAdminTheme={rootAdminTheme} />
            <MenuButton
              icon={CalendarPlus}
              label="Táº¡o booking nhanh"
              rootAdminTheme={rootAdminTheme}
              onClick={() => {
                setOpen(false);
                setActiveResource("booking");
                router.push("/booking", { scroll: false });
              }}
            />
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className={rootAdminTheme ? "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-emerald-400/8" : "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-[#5B342C] transition hover:bg-[#FFF3EC]"}
            >
              <span className="inline-flex items-center gap-2">{darkMode ? <Sun size={16} /> : <Moon size={16} />} Dark mode</span>
              <span className={`h-5 w-9 rounded-full p-0.5 ${rootAdminTheme ? (darkMode ? "bg-emerald-400" : "bg-slate-600") : darkMode ? "bg-[#EA7188]" : "bg-[#F4C7C4]"}`}>
                <span className={`block h-4 w-4 rounded-full bg-white transition ${darkMode ? "translate-x-4" : ""}`} />
              </span>
            </button>
          </div>

          <div className={rootAdminTheme ? "mt-3 border-t border-emerald-300/15 pt-3" : "mt-3 border-t border-[#F4C7C4] pt-3"}>
            <Button variant="ghost" className={rootAdminTheme ? "w-full justify-start text-slate-300 hover:bg-emerald-400/8 hover:text-emerald-100" : "w-full justify-start text-rose-600 hover:bg-rose-50"} onClick={logout} disabled={loggingOut}>
              {loggingOut ? <Loader2 size={16} className="mr-2 animate-spin" /> : <LogOut size={16} className="mr-2" />}
              {loggingOut ? "Äang Ä‘Äƒng xuáº¥t..." : "ÄÄƒng xuáº¥t"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick, rootAdminTheme = false }: { icon: LucideIcon; label: string; onClick: () => void; rootAdminTheme?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={rootAdminTheme ? "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-emerald-400/8 hover:text-emerald-100" : "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#5B342C] transition hover:bg-[#FFF3EC]"}>
      <Icon size={16} />
      {label}
    </button>
  );
}
