import { AppShell } from "@/app/components/layout/app-shell";
import { CategoryPage } from "@/app/components/catalog/category-page";

export default function CategoriesRoute() {
  return (
    <AppShell>
      <CategoryPage />
    </AppShell>
  );
}
