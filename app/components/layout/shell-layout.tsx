"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/app/components/layout/app-shell";

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Các trang không dùng AppShell
  const publicPages = ["/login", "/register", "/forgot-password", "/offline"];
  const isPublic = publicPages.includes(pathname || "");

  if (isPublic) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
