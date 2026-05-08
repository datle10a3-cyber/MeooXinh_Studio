import { AppShell } from "@/app/components/layout/app-shell";
import { ProfilePage } from "@/app/components/profile/profile-page";

export default function Page() {
  return (
    <AppShell>
      <ProfilePage />
    </AppShell>
  );
}
