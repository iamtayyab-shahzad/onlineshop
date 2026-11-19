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
  const [{ data: p }, { data: cost }, { data: images }, { data: cats }, { data: units }] = await Promise.all([
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
  ]);
  if (!p) notFound();

  return (
    <div className="flex flex-col gap-4">
      <AdminTitle title={p.name} backHref="/admin/products">
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

      <ProductForm product={p} supplierPrice={cost?.supplier_price ?? null} categories={cats ?? []} units={units ?? []} />

      <Card title="Delete product" className="border-destructive/40">
        <p className="mb-3 text-sm text-muted-foreground">
          Old orders keep their own copy of the name, quantity and price, so they are not affected. To hide it for a
          while instead, untick “Show in shop”.
        </p>
        <ActionForm
          action={deleteProduct}
          submit="Delete product"
          danger
          confirm={`Delete “${p.name}” permanently? This cannot be undone. Its photos stay in the image library.`}
        >
          <input type="hidden" name="id" value={p.id} />
        </ActionForm>
      </Card>
    </div>
  );
}
