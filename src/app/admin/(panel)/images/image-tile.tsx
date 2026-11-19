import { ActionForm } from "@/components/admin/action-form";
import { assignImage, deleteImage, setMainImage } from "@/app/admin/_actions/images";

export const publicImageUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;

/** One library photo with its admin actions. */
export function ImageTile({
  image,
  isMain,
  products,
  suggested,
}: {
  image: { id: string; path: string; original_name: string; width: number | null; height: number | null; product_id: string | null };
  isMain?: boolean;
  products?: { id: string; name: string }[];
  suggested?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={publicImageUrl(image.path)}
        alt={image.original_name}
        loading="lazy"
        className="aspect-square w-full rounded-lg bg-muted object-contain"
      />
      <p className="truncate text-xs text-muted-foreground" title={image.original_name}>
        {image.original_name}
        {image.width ? ` · ${image.width}×${image.height}` : ""}
      </p>
      {products && (
        <ActionForm action={assignImage} submit="Assign" inline>
          <input type="hidden" name="image_id" value={image.id} />
          <select
            name="product_id"
            defaultValue={suggested ?? ""}
            aria-label="Product"
            className="h-10 w-full rounded-lg border-2 px-2 text-sm"
          >
            <option value="">— choose product —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </ActionForm>
      )}
      {image.product_id && !products && (
        <div className="flex flex-wrap gap-1">
          {isMain ? (
            <span className="rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">Main photo</span>
          ) : (
            <ActionForm action={setMainImage} submit="Make main" inline>
              <input type="hidden" name="image_id" value={image.id} />
            </ActionForm>
          )}
          <ActionForm action={assignImage} submit="Unassign" danger inline>
            <input type="hidden" name="image_id" value={image.id} />
            <input type="hidden" name="product_id" value="" />
          </ActionForm>
        </div>
      )}
      <ActionForm
        action={deleteImage}
        submit="Delete"
        danger
        inline
        confirm="Delete this photo permanently? Products using it will show a plain placeholder."
      >
        <input type="hidden" name="image_id" value={image.id} />
      </ActionForm>
    </div>
  );
}
