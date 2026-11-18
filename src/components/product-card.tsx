import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { ProductImage } from "@/components/product-image";

export function toCartItem(p: Product) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    unit: p.unit_label,
    price: p.selling_price,
    icon: p.category?.icon ?? null,
  };
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <div className="flex flex-col rounded-2xl border bg-card p-3">
      <Link href={`/product/${product.slug}`} className="flex flex-1 flex-col gap-2">
        <ProductImage product={product} className="aspect-square w-full" />
        <div className="flex-1">
          <p className="text-base leading-snug font-semibold">{product.name}</p>
          {product.name_urdu && (
            <p className="text-sm text-muted-foreground" lang="ur" dir="rtl">
              {product.name_urdu}
            </p>
          )}
          <p className="text-sm text-muted-foreground">{product.unit_label}</p>
        </div>
        <p className="text-lg font-bold">{formatPrice(product.selling_price)}</p>
      </Link>
      <AddToCartButton item={toCartItem(product)} className="mt-2" />
    </div>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
