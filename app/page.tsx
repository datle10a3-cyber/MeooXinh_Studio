"use client";

import { useEffect } from "react";
import { AppShell } from "@/app/components/layout/app-shell";
import { DashboardView } from "@/app/components/dashboard/dashboard-view";
import { ReportsView } from "@/app/components/dashboard/system-overview";
import { AiAssistantView } from "@/app/components/ai/ai-assistant-view";
import { ResourceManager } from "@/app/components/resources/resource-manager";
import { ModuleHome } from "@/app/components/home/module-home";
import { TrashView } from "@/app/components/trash/trash-view";
import { UserManagement } from "@/app/components/users/user-management";
import { ProfilePage } from "@/app/components/profile/profile-page";
import { useUiStore } from "@/app/store/ui-store";
import type { ResourceKey } from "@/app/lib/studio-config";

const resourceKeys = new Set([
  "customers",
  "services",
  "bookings",
  "transactions",
  "wallets",
  "projects",
  "invoices",
  "employees",
  "equipment",
  "notifications",
]);

const rootViewKeys = new Set([
  "home",
  "dashboard",
  "ai",
  "reports",
  "trash",
  "users",
  "profile",
  ...Array.from(resourceKeys),
]);

export default function Home() {
  const activeResource = useUiStore((state) => state.activeResource);
  const setActiveResource = useUiStore((state) => state.setActiveResource);

  useEffect(() => {
    function syncViewFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view") || "home";
      setActiveResource(rootViewKeys.has(view) ? view : "home");
    }

    syncViewFromUrl();
    window.addEventListener("popstate", syncViewFromUrl);
    return () => window.removeEventListener("popstate", syncViewFromUrl);
  }, [setActiveResource]);

  return (
    <AppShell>
      {activeResource === "dashboard" ? <DashboardView /> : null}
      {activeResource === "home" ? <ModuleHome /> : null}
      {activeResource === "ai" ? <AiAssistantView /> : null}
      {activeResource === "reports" ? <ReportsView /> : null}
      {activeResource === "trash" ? <TrashView /> : null}
      {activeResource === "users" ? <UserManagement /> : null}
      {activeResource === "profile" ? <ProfilePage /> : null}
      {resourceKeys.has(activeResource) ? <ResourceManager resource={activeResource as ResourceKey} /> : null}
    </AppShell>
  );
}
