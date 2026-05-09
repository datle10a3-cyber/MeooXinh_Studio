import { AppShell } from "@/app/components/layout/app-shell";
import dynamic from "next/dynamic";
import { ViewSkeleton } from "@/app/components/ui/skeleton";

const CategoryPage = dynamic(() => import("@/app/components/catalog/category-page").then((mod) => mod.CategoryPage), {
  loading: () => <ViewSkeleton />,
});

export default function CategoriesRoute() {
  return (
    <AppShell>
      <CategoryPage />
    </AppShell>
  );
}
