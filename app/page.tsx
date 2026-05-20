import dynamic from "next/dynamic";
import { ViewSkeleton } from "@/app/components/ui/skeleton";

const ModuleHome = dynamic(() => import("@/app/components/home/module-home").then((mod) => mod.ModuleHome), {
  loading: () => <ViewSkeleton />,
});

export default function Home() {
  return <ModuleHome />;
}
