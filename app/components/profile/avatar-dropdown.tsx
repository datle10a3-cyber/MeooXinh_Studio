"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, CalendarPlus, LogOut, Moon, Settings, ShieldCheck, Sun, User, type LucideIcon } from "lucide-react";
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

export function AvatarDropdown({ session, onLogout }: { session: CurrentSession; onLogout: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
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
    await fetch("/api/auth/logout", { method: "POST" });
    onLogout();
    router.push("/login");
  }

  function go(resource: string) {
    setOpen(false);
    setActiveResource(resource);
    navigateStudioView(router, pathname, resource);
  }

  return (
    <div ref={boxRef} className="relative">
      <button type="button" className="rounded-full transition active:scale-95" onClick={() => setOpen((value) => !value)} aria-label="Mở tài khoản">
        <AvatarUser name={session.user.name} avatarUrl={session.user.avatarUrl} />
      </button>

      {open ? (
        <div className="absolute right-0 top-14 z-50 w-[260px] rounded-xl border border-[#F4C7C4] bg-white p-3 shadow-xl">
          <div className="flex items-center gap-3 rounded-xl bg-[#FFF3EC] p-3">
            <AvatarUser name={session.user.name} avatarUrl={session.user.avatarUrl} size="lg" />
            <div className="min-w-0">
              <p className="whitespace-normal break-words text-sm font-bold leading-5 text-[#5B342C]">{session.user.name}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#9B746B]">
                <ShieldCheck size={12} />
                {roleText(session.user.role)}
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <MenuButton icon={User} label="Trang cá nhân" onClick={() => go("profile")} />
            <MenuButton icon={Building2} label="Thông tin studio" onClick={() => go("home")} />
            <MenuButton icon={Settings} label="Cài đặt" onClick={() => go("home")} />
            <MenuButton
              icon={CalendarPlus}
              label="Tạo booking nhanh"
              onClick={() => {
                setOpen(false);
                setActiveResource("booking");
                router.push("/booking", { scroll: false });
              }}
            />
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-[#5B342C] transition hover:bg-[#FFF3EC]"
            >
              <span className="inline-flex items-center gap-2">{darkMode ? <Sun size={16} /> : <Moon size={16} />} Dark mode</span>
              <span className={`h-5 w-9 rounded-full p-0.5 ${darkMode ? "bg-[#EA7188]" : "bg-[#F4C7C4]"}`}>
                <span className={`block h-4 w-4 rounded-full bg-white transition ${darkMode ? "translate-x-4" : ""}`} />
              </span>
            </button>
          </div>

          <div className="mt-3 border-t border-[#F4C7C4] pt-3">
            <Button variant="ghost" className="w-full justify-start text-rose-600 hover:bg-rose-50" onClick={logout}>
              <LogOut size={16} />
              Đăng xuất
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#5B342C] transition hover:bg-[#FFF3EC]">
      <Icon size={16} />
      {label}
    </button>
  );
}
