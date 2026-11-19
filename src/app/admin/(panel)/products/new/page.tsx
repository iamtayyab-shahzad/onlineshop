import type { Metadata } from "next";
import { adminDb } from "@/lib/auth";
import { AdminTitle, Empty } from "@/components/admin/admin-ui";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  const { supabase } = await adminDb();
  const [{ data: cats }, { data: units }] = await Promise.all([
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("units").select("id, name, allow_decimal").eq("is_active", true).order("sort_order"),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <AdminTitle title="Add product" backHref="/admin/products" />
      {!cats?.length || !units?.length ? (
        <Empty>Add at least one category and one unit first.</Empty>
      ) : (
        <ProductForm categories={cats} units={units} />
      )}
    </div>
  );
}
