import dynamic from "next/dynamic";
import { ViewSkeleton } from "@/app/components/ui/skeleton";

const RootAdminList = dynamic(() => import("@/app/components/root-admin/admin-list").then((mod) => mod.RootAdminList), {
  loading: () => <ViewSkeleton />,
});

export default function RootAdminsPage() {
  return <RootAdminList />;
}
