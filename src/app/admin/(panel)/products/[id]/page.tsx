import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/auth";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, Card, LinkButton } from "@/components/admin/admin-ui";
import { ImageUploader } from "@/components/admin/image-uploader";
import { deleteProduct } from "@/app/admin/_actions/catalog";
import { ImageTile, publicImageUrl } from "../../images/image-tile";
import { ProductForm } from "../product-form";
import { isUuid } from "@/lib/admin-types";
import { formatPrice } from "@/lib/format";
import Link from "next/link";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const { supabase } = await adminDb();
  const [{ data: p }, { data: cost }, { data: images }, { data: cats }, { data: units }, { data: sizes }, { data: mains }] =
    await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("product_costs").select("supplier_price").eq("product_id", id).maybeSingle(),
    supabase
      .from("product_images")
      .select("id, path, original_name, width, height, product_id")
      .eq("product_id", id)
      .order("sort_order")
      .order("created_at"),
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("units").select("id, name, allow_decimal").order("sort_order"),
    supabase
      .from("products")
      .select("id, name, unit_label, selling_price, is_active, in_stock")
      .eq("variant_of", id)
      .order("selling_price"),
    supabase.from("products").select("id, name, unit_label").is("variant_of", null).neq("id", id).order("name").limit(500),
  ]);
  if (!p) notFound();
  const parent = p.variant_of ? mains?.find((m) => m.id === p.variant_of) : undefined;
  const hasSizes = !!sizes?.length;

  return (
    <div className="flex flex-col gap-4">
      <AdminTitle title={p.variant_of ? `${p.name} (${p.unit_label})` : p.name} backHref={p.variant_of ? `/admin/products/${p.variant_of}` : "/admin/products"}>
        {p.is_active && (
          <LinkButton href={`/product/${p.slug}`} variant="outline">
            View in shop
          </LinkButton>
        )}
      </AdminTitle>
      {created && <p className="rounded-lg bg-primary/10 p-3 font-medium text-primary">Product added. Now add its photos below.</p>}

      <Card title="Photos">
        {images?.length ? (
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {images.map((img) => (
              <ImageTile key={img.id} image={img} isMain={p.image_url === publicImageUrl(img.path)} />
            ))}
          </div>
        ) : (
          <p className="mb-3 text-sm text-muted-foreground">No photos yet. Customers see a plain placeholder.</p>
        )}
        <ImageUploader productId={p.id} />
        <p className="mt-2 text-xs text-muted-foreground">
          You can also assign photos already uploaded from the{" "}
          <a href="/admin/images" className="text-primary">
            Images
          </a>{" "}
          page.
        </p>
      </Card>

      {p.variant_of ? (
        <p className="rounded-lg bg-muted p-3 text-sm">
          This is a size of{" "}
          <Link href={`/admin/products/${p.variant_of}`} className="font-semibold text-primary">
            {parent ? parent.name : "its main product"}
          </Link>
          . Customers pick it on the main product&apos;s page.
        </p>
      ) : (
        <Card title="Sizes">
          <p className="mb-3 text-sm text-muted-foreground">
            Sell this product in more than one size (for example 1 kg, 500 g and 250 g), each with its own price. Customers
            see the sizes with prices on the product page and choose one. The product above is the first size.
          </p>
          {hasSizes && (
            <ul className="mb-3 divide-y rounded-lg border">
              {sizes.map((z) => (
                <li key={z.id} className={`flex items-center justify-between gap-3 px-3 py-2 ${z.is_active ? "" : "opacity-60"}`}>
                  <span className="font-semibold">
                    {z.unit_label} <span className="font-normal tabular-nums">· {formatPrice(z.selling_price)}</span>
                    {!z.in_stock && <span className="ml-2 text-xs text-destructive">out of stock</span>}
                    {!z.is_active && <span className="ml-2 text-xs text-muted-foreground">hidden</span>}
                  </span>
                  <Link href={`/admin/products/${z.id}`} className="text-sm font-semibold text-primary">
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <LinkButton href={`/admin/products/new?variant_of=${p.id}`} variant="outline">
            Add a size
          </LinkButton>
        </Card>
      )}

      <ProductForm
        product={p}
        supplierPrice={cost?.supplier_price ?? null}
        categories={cats ?? []}
        units={units ?? []}
        variantOf={p.variant_of}
        mains={hasSizes ? undefined : (mains ?? []).map((m) => ({ id: m.id, name: `${m.name} (${m.unit_label})` }))}
      />

      <Card title="Delete product" className="border-destructive/40">
        <p className="mb-3 text-sm text-muted-foreground">
          Old orders keep their own copy of the name, quantity and price, so they are not affected. To hide it for a
          while instead, untick “Show in shop”.
        </p>
        <ActionForm
          action={deleteProduct}
          submit="Delete product"
          danger
          confirm={`Delete “${p.name}${p.variant_of ? ` (${p.unit_label})` : ""}” permanently? This cannot be undone. Its photos stay in the image library.${hasSizes ? " Its sizes stay in the shop as separate products." : ""}`}
        >
          <input type="hidden" name="id" value={p.id} />
        </ActionForm>
      </Card>
    </div>
  );
}
