import dynamic from "next/dynamic";
import { ViewSkeleton } from "@/app/components/ui/skeleton";

const UserManagement = dynamic(() => import("@/app/components/users/user-management").then((mod) => mod.UserManagement), {
  loading: () => <ViewSkeleton />,
});

export default function Page() {
  return <UserManagement />;
}
