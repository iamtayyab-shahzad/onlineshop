import type { Metadata } from "next";
import Link from "next/link";
import { adminDb } from "@/lib/auth";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, Empty, LinkButton, Table } from "@/components/admin/admin-ui";
import { quickProductUpdate } from "@/app/admin/_actions/catalog";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const { supabase } = await adminDb();
  const { q, cat } = await searchParams;
  let query = supabase
    .from("products")
    .select("id, name, slug, image_url, selling_price, unit_label, is_active, in_stock, purchase_method, category_id, variant_of, product_costs(supplier_price)")
    .order("sort_order")
    .order("name")
    .limit(300);
  const term = q?.trim().replace(/[%,()]/g, "");
  if (term) query = query.ilike("name", `%${term}%`);
  if (cat) query = query.eq("category_id", cat);
  const [{ data: products }, { data: cats }] = await Promise.all([
    query,
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);
  const catName = new Map((cats ?? []).map((c) => [c.id, c.name]));
  const sizeCount = new Map<string, number>();
  for (const p of products ?? []) if (p.variant_of) sizeCount.set(p.variant_of, (sizeCount.get(p.variant_of) ?? 0) + 1);

  return (
    <div>
      <AdminTitle title="Products">
        <LinkButton href="/admin/products/new">Add product</LinkButton>
      </AdminTitle>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name" className="h-10 w-full max-w-xs rounded-lg border-2 px-3" />
        <select name="cat" defaultValue={cat ?? ""} className="h-10 rounded-lg border-2 px-3">
          <option value="">All categories</option>
          {cats?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-lg border-2 px-4 text-sm font-semibold">Filter</button>
      </form>
      {!products?.length ? (
        <Empty>No products yet.</Empty>
      ) : (
        <Table head={["", "Product", "Supplier", "Price / stock (quick edit)", ""]}>
          {products.map((p) => {
            const cost = p.product_costs?.supplier_price;
            return (
              <tr key={p.id} className={p.is_active ? "" : "opacity-60"}>
                <td className="w-14 px-3 py-2">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="size-12 rounded-lg bg-muted object-contain" loading="lazy" />
                  ) : (
                    <div className="size-12 rounded-lg bg-muted" />
                  )}
                </td>
                <td className="px-3 py-2">
                  <Link href={`/admin/products/${p.id}`} className="font-semibold text-primary">
                    {p.name}
                    {p.variant_of && <span className="font-normal text-foreground"> ({p.unit_label})</span>}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {catName.get(p.category_id)} · per {p.unit_label}
                    {p.purchase_method !== "quantity" ? " · by amount" : ""}
                    {p.variant_of ? " · a size" : sizeCount.get(p.id) ? ` · ${sizeCount.get(p.id)! + 1} sizes` : ""}
                    {!p.is_active ? " · hidden" : ""}
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground tabular-nums">
                  {cost != null ? formatPrice(cost) : <span className="text-amber-700">not set</span>}
                  {cost != null && Number(p.selling_price) < Number(cost) && (
                    <div className="text-xs font-semibold text-destructive">below cost!</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <ActionForm action={quickProductUpdate} submit="Save" inline>
                    <input type="hidden" name="id" value={p.id} />
                    <input
                      name="selling_price"
                      defaultValue={p.selling_price}
                      inputMode="decimal"
                      aria-label={`Price of ${p.name}`}
                      className="h-10 w-24 rounded-lg border-2 px-2"
                    />
                    <label className="flex items-center gap-1 text-sm">
                      <input type="checkbox" name="in_stock" defaultChecked={p.in_stock} className="size-5 accent-primary" />
                      In stock
                    </label>
                  </ActionForm>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/admin/products/${p.id}`} className="text-sm text-primary">
                    Edit
                  </Link>
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
