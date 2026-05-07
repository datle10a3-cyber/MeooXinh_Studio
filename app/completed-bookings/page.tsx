import { BookingPage } from "@/app/components/catalog/booking-page";
import { AppShell } from "@/app/components/layout/app-shell";

export default function CompletedBookingsRoute() {
  return (
    <AppShell>
      <BookingPage completedOnly />
    </AppShell>
  );
}
