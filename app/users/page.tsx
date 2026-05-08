import { AppShell } from "@/app/components/layout/app-shell";
import { UserManagement } from "@/app/components/users/user-management";

export default function Page() {
  return (
    <AppShell>
      <UserManagement />
    </AppShell>
  );
}
