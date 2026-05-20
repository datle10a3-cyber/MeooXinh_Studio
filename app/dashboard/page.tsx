import dynamic from "next/dynamic";
import { ViewSkeleton } from "@/app/components/ui/skeleton";

const DashboardView = dynamic(() => import("@/app/components/dashboard/dashboard-view").then((mod) => mod.DashboardView), {
  loading: () => <ViewSkeleton />,
});

export default function Page() {
  return <DashboardView />;
}
