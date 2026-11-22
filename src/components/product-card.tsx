import Link from "next/link";
import type { Product, Size } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { ProductImage } from "@/components/product-image";
import { toCartItem } from "@/lib/catalog-item";

export { toCartItem };

type CardProduct = Product & { sizes?: Size[] };

export function ProductCard({ product }: { product: CardProduct }) {
  const sizes = product.sizes ?? [];
  // The main product is one size itself; with others, show "From Rs X" and ask the customer to choose.
  const hasSizes = sizes.length > 0;
  const all = [{ selling_price: product.selling_price, in_stock: product.in_stock }, ...sizes];
  const available = all.filter((s) => s.in_stock);
  const fromPrice = Math.min(...(available.length > 0 ? available : all).map((s) => s.selling_price));
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
          <p className="text-sm text-muted-foreground">
            {hasSizes ? `${all.length} sizes` : product.unit_label}
          </p>
        </div>
        <p className="text-lg font-bold">
          {hasSizes && <span className="text-sm font-medium text-muted-foreground">From </span>}
          {formatPrice(hasSizes ? fromPrice : product.selling_price)}
        </p>
        {!hasSizes && product.purchase_method !== "quantity" && product.min_amount != null && (
          <p className="text-sm font-medium text-primary">Buy from {formatPrice(product.min_amount)}</p>
        )}
      </Link>
      {hasSizes ? (
        <Link
          href={`/product/${product.slug}`}
          className="mt-2 flex h-12 items-center justify-center rounded-xl bg-primary px-3 text-base font-semibold text-primary-foreground"
        >
          Choose size
        </Link>
      ) : (
        <AddToCartButton item={toCartItem(product)} inStock={product.in_stock} className="mt-2" />
      )}
    </div>
  );
}

export function ProductGrid({ products }: { products: CardProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
