import { AppShell } from "@/app/components/layout/app-shell";
import dynamic from "next/dynamic";
import { ViewSkeleton } from "@/app/components/ui/skeleton";

const PackagePage = dynamic(() => import("@/app/components/catalog/package-page").then((mod) => mod.PackagePage), {
  loading: () => <ViewSkeleton />,
});

export default function PackagesRoute() {
  return (
    <AppShell>
      <PackagePage />
    </AppShell>
  );
}
