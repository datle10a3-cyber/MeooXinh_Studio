"use client";

import Link from "next/link";
import { LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { AvatarDropdown } from "@/app/components/profile/avatar-dropdown";
import type { CurrentSession } from "@/app/types/auth";

function roleLabel(role?: string) {
  if (role === "ADMIN") return "Quản trị viên";
  if (role === "MANAGER") return "Quản lý";
  return "Nhân viên";
}

export function UserMenu({ session, onLogout }: { session: CurrentSession | null; onLogout: () => void }) {
  if (!session) {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        <Link href="/login" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#F4C7C4] bg-white px-3 text-sm font-bold text-[#5B342C] shadow-sm transition duration-200 hover:bg-[#FFF0F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA7188]/35 sm:h-11 sm:rounded-2xl sm:px-5">
          <LogIn size={17} />
          <span className="hidden min-[420px]:inline">Đăng nhập</span>
        </Link>
        <Link href="/register" className="hidden h-10 items-center justify-center gap-2 rounded-xl bg-[#FFE1E8] px-3 text-sm font-bold text-[#A84E61] shadow-sm transition duration-200 hover:bg-[#FFD4DF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA7188]/35 sm:inline-flex sm:h-11 sm:rounded-2xl sm:px-5">
          <UserPlus size={17} />
          <span>Tạo studio bằng mã mời</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-semibold text-[#5B342C]">{session.user.name}</p>
        <p className="flex items-center justify-end gap-1 text-xs text-[#9B746B]">
          <ShieldCheck size={13} />
          {roleLabel(session.user.role)}
        </p>
      </div>
      <AvatarDropdown session={session} onLogout={onLogout} />
    </div>
  );
}
