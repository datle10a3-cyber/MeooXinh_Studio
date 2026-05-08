import { AppShell } from "@/app/components/layout/app-shell";
import { BookingPage } from "@/app/components/catalog/booking-page";

export default function CompletedBookingsRoute() {
  return (
    <AppShell>
      <BookingPage completedOnly />
    </AppShell>
  );
}
