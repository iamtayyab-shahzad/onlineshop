import type { Product } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * Shows the product photo when one is uploaded, otherwise a calm placeholder
 * with the category icon so the grid still reads clearly.
 */
export function ProductImage({
  product,
  className,
}: {
  product: Pick<Product, "name" | "image_url"> & { category?: Product["category"] };
  className?: string;
}) {
  if (product.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- images are already resized WebP in Supabase Storage
      <img
        src={product.image_url}
        alt={product.name}
        loading="lazy"
        decoding="async"
        className={cn("rounded-xl bg-muted object-contain", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn("flex items-center justify-center rounded-xl bg-secondary text-5xl", className)}
    >
      {product.category?.icon ?? "🛒"}
    </div>
  );
}
