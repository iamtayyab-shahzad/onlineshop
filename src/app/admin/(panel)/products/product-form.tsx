import { ActionForm } from "@/components/admin/action-form";
import { Card, Check, Input, Select, inputCls } from "@/components/admin/admin-ui";
import { saveProduct } from "@/app/admin/_actions/catalog";
import type { Database } from "@/lib/database.types";

type Product = Database["public"]["Tables"]["products"]["Row"];
type Opt = { id: string; name: string };

/** Add / edit product. All values are checked again on the server and by database rules. */
export function ProductForm({
  product: p,
  prefill,
  supplierPrice,
  categories,
  units,
  mains,
  variantOf,
}: {
  product?: Product;
  /** Starting values for a new product (used by "Add a size"); ignored when editing. */
  prefill?: Partial<Product>;
  supplierPrice?: number | null;
  categories: Opt[];
  units: (Opt & { allow_decimal: boolean })[];
  /** Main products this one can be a size of. Leave out to hide the choice (e.g. a product that already has sizes). */
  mains?: Opt[];
  /** The main product this is (or will be) a size of. */
  variantOf?: string | null;
}) {
  const d = p ?? prefill;
  const isSize = !!variantOf;
  return (
    <ActionForm action={saveProduct} submit={p ? "Save changes" : "Add product"}>
      {p && <input type="hidden" name="id" value={p.id} />}
      {mains && (
        <Card title="Size of another product?">
          <Select
            label="Size of (optional)"
            name="variant_of"
            defaultValue={variantOf ?? ""}
            options={[{ value: "", label: "No — this is a normal product" }, ...mains.map((m) => ({ value: m.id, label: m.name }))]}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Choose the main product if this is another size of it (for example 500 g of Vital Tea). Customers then pick the
            size on the main product&apos;s page. Each size keeps its own price, supplier price and stock.
          </p>
        </Card>
      )}
      <Card title="Basic">
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Name" name="name" required maxLength={120} defaultValue={d?.name} />
          <Input label="Urdu name (optional)" name="name_urdu" maxLength={120} defaultValue={d?.name_urdu ?? ""} dir="auto" />
          <Select
            label="Category"
            name="category_id"
            required
            defaultValue={d?.category_id}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Input
            label="Web name (slug)"
            name="slug"
            maxLength={60}
            defaultValue={d?.slug}
            hint="Leave empty to make it from the name."
          />
          <label className="flex flex-col gap-1 text-sm font-semibold md:col-span-2">
            Description (optional)
            <textarea name="description" rows={2} maxLength={1000} defaultValue={d?.description ?? ""} className={inputCls + " h-auto py-2"} />
          </label>
        </div>
      </Card>

      <Card title="Price">
        <div className="grid gap-3 md:grid-cols-3">
          <Select
            label="Unit"
            name="unit_id"
            required
            defaultValue={d?.unit_id}
            options={units.map((u) => ({ value: u.id, label: `${u.name}${u.allow_decimal ? " (decimals ok)" : ""}` }))}
          />
          <Input
            label={isSize ? "Size name" : "Price label"}
            name="unit_label"
            maxLength={40}
            required={isSize}
            defaultValue={d?.unit_label}
            hint={
              isSize
                ? "Shown on the size button, e.g. 1 kg, 500 g, 250 g."
                : "Shown as “per …”, e.g. kg, 12 pcs, 1 L bottle. Empty = unit name. Give a size name like 1 kg if this product will have sizes."
            }
          />
          <Input label="Selling price (Rs)" name="selling_price" required inputMode="decimal" defaultValue={d?.selling_price} />
          <Input
            label="Supplier price (Rs) — private"
            name="supplier_price"
            inputMode="decimal"
            defaultValue={supplierPrice ?? ""}
            hint="Only admins see this. Used for profit."
          />
        </div>
      </Card>

      <Card title="How customers buy">
        <div className="grid gap-3 md:grid-cols-3">
          <Select
            label="Buying method"
            name="purchase_method"
            defaultValue={d?.purchase_method ?? "quantity"}
            options={[
              { value: "quantity", label: "By quantity (1, 2, 3…)" },
              { value: "amount", label: "By rupee amount only" },
              { value: "both", label: "Quantity or amount" },
            ]}
          />
          <Input label="Min quantity" name="min_qty" inputMode="decimal" defaultValue={d?.min_qty ?? 1} />
          <Input label="Max quantity" name="max_qty" inputMode="decimal" defaultValue={d?.max_qty ?? 50} />
          <Input label="Step" name="qty_step" inputMode="decimal" defaultValue={d?.qty_step ?? 1} hint="e.g. 0.25 for ¼ kg" />
          <Input
            label="Min amount (Rs)"
            name="min_amount"
            inputMode="numeric"
            defaultValue={d?.min_amount ?? ""}
            hint="Needed for amount buying, e.g. 50"
          />
          <Input label="Max amount (Rs)" name="max_amount" inputMode="numeric" defaultValue={d?.max_amount ?? ""} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Example: potato Rs 100 per kg, min amount Rs 50 → a customer paying Rs 150 gets 1.5 kg.
        </p>
      </Card>

      <Card title="Show">
        <div className="flex flex-wrap gap-x-6">
          <Check label="Show in shop" name="is_active" defaultChecked={d?.is_active ?? true} />
          <Check label="In stock" name="in_stock" defaultChecked={d?.in_stock ?? true} />
          <Check label="Featured on home" name="is_featured" defaultChecked={d?.is_featured ?? false} />
          <Input label="Sort order" name="sort_order" inputMode="numeric" defaultValue={d?.sort_order ?? 0} className="w-28" />
        </div>
      </Card>
    </ActionForm>
  );
}
