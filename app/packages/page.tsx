import { AppShell } from "@/app/components/layout/app-shell";
import { PackagePage } from "@/app/components/catalog/package-page";

export default function PackagesRoute() {
  return (
    <AppShell>
      <PackagePage />
    </AppShell>
  );
}
