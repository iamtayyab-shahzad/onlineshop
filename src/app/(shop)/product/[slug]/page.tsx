import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getAllProductSlugs, getProductBySlug, getSizeGroup } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { AddToCartButton, AmountPicker } from "@/components/add-to-cart-button";
import { SaveProductButton } from "@/components/save-to-monthly";
import { toCartItem } from "@/lib/catalog-item";
import { ProductImage } from "@/components/product-image";
import { SizePicker } from "@/components/size-picker";
import { PageTitle } from "@/components/page-title";
import { BlockSkeleton } from "@/components/skeletons";
import Link from "next/link";

export async function generateStaticParams() {
  const slugs = await getAllProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  return { title: product ? `${product.name} (${product.unit_label})` : "Product" };
}

export default function ProductPage({ params }: PageProps<"/product/[slug]">) {
  return (
    <Suspense fallback={<BlockSkeleton />}>
      <ProductContent params={params} />
    </Suspense>
  );
}

async function ProductContent({ params }: { params: Promise<{ slug: string }> }) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  const category = product.category;
  const sizes = await getSizeGroup(product);

  return (
    <article className="flex flex-col gap-4">
      <PageTitle
        title={product.name}
        subtitle={product.name_urdu}
        backHref={category ? `/category/${category.slug}` : "/"}
        backLabel={category ? category.name : "Home"}
      />
      <ProductImage product={product} className="mx-auto aspect-square w-full max-w-sm text-8xl" />
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-base text-muted-foreground">{product.unit_label}</p>
          <p className="text-3xl font-bold">{formatPrice(product.selling_price)}</p>
        </div>
      </div>
      <SizePicker sizes={sizes} currentId={product.id} />
      {product.description && <p className="text-lg leading-relaxed">{product.description}</p>}
      {product.purchase_method !== "amount" || !product.in_stock ? (
        <AddToCartButton item={toCartItem(product)} inStock={product.in_stock} size="lg" />
      ) : null}
      {product.in_stock && product.purchase_method !== "quantity" && product.min_amount != null && (
        <AmountPicker item={toCartItem(product)} />
      )}
      {product.in_stock && <SaveProductButton item={toCartItem(product)} />}
      <Link
        href="/cart"
        className="flex h-12 items-center justify-center rounded-xl border-2 text-base font-semibold"
      >
        Go to cart
      </Link>
    </article>
  );
}
