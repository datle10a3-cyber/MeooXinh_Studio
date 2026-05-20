import dynamic from "next/dynamic";
import { ViewSkeleton } from "@/app/components/ui/skeleton";

const PackagePage = dynamic(() => import("@/app/components/catalog/package-page").then((mod) => mod.PackagePage), {
  loading: () => <ViewSkeleton />,
});

export default function PackagesRoute() {
  return <PackagePage />;
}
