import { AppShell } from "@/app/components/layout/app-shell";
import { DashboardView } from "@/app/components/dashboard/dashboard-view";

export default function Page() {
  return (
    <AppShell>
      <DashboardView />
    </AppShell>
  );
}
