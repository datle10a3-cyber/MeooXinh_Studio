import { AppShell } from "@/app/components/layout/app-shell";
import dynamic from "next/dynamic";
import { ViewSkeleton } from "@/app/components/ui/skeleton";

const ReportsView = dynamic(() => import("@/app/components/dashboard/system-overview").then((mod) => mod.ReportsView), {
  loading: () => <ViewSkeleton />,
});

export default function Page() {
  return (
    <AppShell>
      <ReportsView />
    </AppShell>
  );
}
