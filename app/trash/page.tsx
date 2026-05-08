import { AppShell } from "@/app/components/layout/app-shell";
import { TrashView } from "@/app/components/trash/trash-view";

export default function Page() {
  return (
    <AppShell>
      <TrashView />
    </AppShell>
  );
}
