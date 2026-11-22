import type { Metadata } from "next";
import { adminDb } from "@/lib/auth";
import { isUuid } from "@/lib/admin-types";
import { AdminTitle, Empty } from "@/components/admin/admin-ui";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ variant_of?: string }> }) {
  const { variant_of } = await searchParams;
  const { supabase } = await adminDb();
  const [{ data: cats }, { data: units }, { data: mains }] = await Promise.all([
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("units").select("id, name, allow_decimal").eq("is_active", true).order("sort_order"),
    supabase.from("products").select("id, name, unit_label").is("variant_of", null).order("name").limit(500),
  ]);

  // "Add a size" from a main product: start from its details so only the size name and prices need typing.
  const main = isUuid(variant_of) ? (await supabase.from("products").select("*").eq("id", variant_of).is("variant_of", null).maybeSingle()).data : null;
  const prefill = main
    ? {
        name: main.name,
        name_urdu: main.name_urdu,
        category_id: main.category_id,
        unit_id: main.unit_id,
        description: main.description,
        purchase_method: main.purchase_method,
        min_qty: main.min_qty,
        max_qty: main.max_qty,
        qty_step: main.qty_step,
        min_amount: main.min_amount,
        max_amount: main.max_amount,
        is_active: main.is_active,
      }
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <AdminTitle
        title={main ? `Add a size of ${main.name}` : "Add product"}
        backHref={main ? `/admin/products/${main.id}` : "/admin/products"}
      />
      {!cats?.length || !units?.length ? (
        <Empty>Add at least one category and one unit first.</Empty>
      ) : (
        <ProductForm
          categories={cats}
          units={units}
          prefill={prefill}
          variantOf={main?.id ?? null}
          mains={(mains ?? []).map((m) => ({ id: m.id, name: `${m.name} (${m.unit_label})` }))}
        />
      )}
    </div>
  );
}
