import { AppShell } from "@/app/components/layout/app-shell";
import dynamic from "next/dynamic";
import { ViewSkeleton } from "@/app/components/ui/skeleton";

const BookingPage = dynamic(() => import("@/app/components/catalog/booking-page").then((mod) => mod.BookingPage), {
  loading: () => <ViewSkeleton />,
});

export default function CompletedBookingsRoute() {
  return (
    <AppShell>
      <BookingPage completedOnly />
    </AppShell>
  );
}
