import { AppShell } from "@/app/components/layout/app-shell";
import { ResourceManager } from "@/app/components/resources/resource-manager";

export default function Page() {
  return (
    <AppShell>
      <ResourceManager resource="customers" />
    </AppShell>
  );
}
