import dynamic from "next/dynamic";
import { ViewSkeleton } from "@/app/components/ui/skeleton";

const ProfilePage = dynamic(() => import("@/app/components/profile/profile-page").then((mod) => mod.ProfilePage), {
  loading: () => <ViewSkeleton />,
});

export default function Page() {
  return <ProfilePage />;
}
