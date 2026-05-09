import { AppShell } from "@/app/components/layout/app-shell";
import dynamic from "next/dynamic";
import { ViewSkeleton } from "@/app/components/ui/skeleton";

const TrashView = dynamic(() => import("@/app/components/trash/trash-view").then((mod) => mod.TrashView), {
  loading: () => <ViewSkeleton />,
});

export default function Page() {
  return (
    <AppShell>
      <TrashView />
    </AppShell>
  );
}
