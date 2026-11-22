import type { Metadata } from "next";
import Link from "next/link";
import { adminDb } from "@/lib/auth";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, Card, Empty } from "@/components/admin/admin-ui";
import { ImageUploader } from "@/components/admin/image-uploader";
import { confirmMatches } from "@/app/admin/_actions/images";
import { ImageTile, publicImageUrl } from "./image-tile";
import { slugify } from "@/lib/admin-types";

export const metadata: Metadata = { title: "Images" };

/** File name → product, only on an exact slug / name match. Anything else stays for manual assignment. */
function suggest(fileName: string, bySlug: Map<string, string>) {
  const base = slugify(fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_ ]\d+$/, ""));
  return bySlug.get(base);
}

export default async function ImagesPage() {
  const { supabase } = await adminDb();
  const [{ data: unassigned }, { data: products }, { count: assigned }] = await Promise.all([
    supabase
      .from("product_images")
      .select("id, path, original_name, width, height, product_id")
      .is("product_id", null)
      .order("original_name")
      .limit(300),
    supabase.from("products").select("id, name, slug, unit_label, variant_of").order("name"),
    supabase.from("product_images").select("id", { count: "exact", head: true }).not("product_id", "is", null),
  ]);
  const bySlug = new Map<string, string>();
  for (const p of products ?? []) {
    bySlug.set(p.slug, p.id);
    // Sizes share their main product’s name, so only the main product answers to the plain name.
    if (!p.variant_of) bySlug.set(slugify(p.name), p.id);
  }
  const shown = (products ?? []).map((p) => ({ ...p, name: p.variant_of ? `${p.name} (${p.unit_label})` : p.name }));
  const nameOf = new Map(shown.map((p) => [p.id, p.name]));
  const matches = (unassigned ?? [])
    .map((img) => ({ img, productId: suggest(img.original_name, bySlug) }))
    .filter((m): m is { img: (typeof m)["img"]; productId: string } => !!m.productId);

  return (
    <div className="flex flex-col gap-4">
      <AdminTitle title="Product images" />
      <ImageUploader />
      <p className="text-sm text-muted-foreground">
        {assigned ?? 0} photo(s) are on products. Open a product to change its main photo or extra photos.
      </p>

      {matches.length > 0 && (
        <Card title={`Suggested matches (${matches.length})`}>
          <p className="mb-3 text-sm text-muted-foreground">
            The file name matches a product name exactly. Untick any that are wrong, then confirm.
          </p>
          <ActionForm action={confirmMatches} submit="Confirm ticked matches">
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map(({ img, productId }) => (
                <li key={img.id} className="flex items-center gap-3 rounded-lg border p-2">
                  <input
                    type="checkbox"
                    name="pair"
                    value={`${img.id}:${productId}`}
                    defaultChecked
                    className="size-5 accent-primary"
                    aria-label={`Match ${img.original_name}`}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={publicImageUrl(img.path)} alt="" className="size-14 rounded bg-muted object-contain" loading="lazy" />
                  <span className="text-sm">
                    <span className="block truncate text-muted-foreground">{img.original_name}</span>→{" "}
                    <span className="font-semibold">{nameOf.get(productId)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </ActionForm>
        </Card>
      )}

      <h2 className="text-lg font-bold">Not assigned yet ({unassigned?.length ?? 0})</h2>
      {!unassigned?.length ? (
        <Empty>
          All photos are assigned. Products without a photo show a plain placeholder.{" "}
          <Link href="/admin/products" className="text-primary">
            See products
          </Link>
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {unassigned.map((img) => (
            <ImageTile key={img.id} image={img} products={shown} suggested={suggest(img.original_name, bySlug)} />
          ))}
        </div>
      )}
    </div>
  );
}
