import { AppShell } from "@/app/components/layout/app-shell";
import dynamic from "next/dynamic";
import { ViewSkeleton } from "@/app/components/ui/skeleton";

const ResourceManager = dynamic(() => import("@/app/components/resources/resource-manager").then((mod) => mod.ResourceManager), {
  loading: () => <ViewSkeleton />,
});

export default function Page() {
  return (
    <AppShell>
      <ResourceManager resource="wallets" />
    </AppShell>
  );
}
