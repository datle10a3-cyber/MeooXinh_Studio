import { AppShell } from "@/app/components/layout/app-shell";
import { ReportsView } from "@/app/components/dashboard/system-overview";

export default function Page() {
  return (
    <AppShell>
      <ReportsView />
    </AppShell>
  );
}
