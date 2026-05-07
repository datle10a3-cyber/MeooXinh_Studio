"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { AppShell } from "@/app/components/layout/app-shell";
import { useUiStore } from "@/app/store/ui-store";
import type { ResourceKey } from "@/app/lib/studio-config";
import { STUDIO_VIEW_NAVIGATION_EVENT } from "@/app/utils/studio-navigation";

function ViewLoading() {
  return (
    <div className="rounded-2xl border border-[#F4C7C4] bg-white px-4 py-6 text-sm font-bold text-[#9B746B] shadow-sm">
      Dang mo man hinh...
    </div>
  );
}

const DashboardView = dynamic(() => import("@/app/components/dashboard/dashboard-view").then((mod) => mod.DashboardView), { loading: ViewLoading, ssr: false });
const ReportsView = dynamic(() => import("@/app/components/dashboard/system-overview").then((mod) => mod.ReportsView), { loading: ViewLoading, ssr: false });
const AiAssistantView = dynamic(() => import("@/app/components/ai/ai-assistant-view").then((mod) => mod.AiAssistantView), { loading: ViewLoading, ssr: false });
const ResourceManager = dynamic(() => import("@/app/components/resources/resource-manager").then((mod) => mod.ResourceManager), { loading: ViewLoading, ssr: false });
const ModuleHome = dynamic(() => import("@/app/components/home/module-home").then((mod) => mod.ModuleHome), { loading: ViewLoading, ssr: false });
const TrashView = dynamic(() => import("@/app/components/trash/trash-view").then((mod) => mod.TrashView), { loading: ViewLoading, ssr: false });
const UserManagement = dynamic(() => import("@/app/components/users/user-management").then((mod) => mod.UserManagement), { loading: ViewLoading, ssr: false });
const ProfilePage = dynamic(() => import("@/app/components/profile/profile-page").then((mod) => mod.ProfilePage), { loading: ViewLoading, ssr: false });

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
    window.addEventListener(STUDIO_VIEW_NAVIGATION_EVENT, syncViewFromUrl);
    return () => {
      window.removeEventListener("popstate", syncViewFromUrl);
      window.removeEventListener(STUDIO_VIEW_NAVIGATION_EVENT, syncViewFromUrl);
    };
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
