import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCategories, getCategoryBySlug, getProductsByCategory } from "@/lib/catalog";
import { ProductGrid } from "@/components/product-card";
import { PageTitle } from "@/components/page-title";
import { ProductGridSkeleton } from "@/components/skeletons";

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const category = await getCategoryBySlug((await params).slug);
  return { title: category?.name ?? "Category" };
}

export default function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <CategoryContent params={params} />
    </Suspense>
  );
}

async function CategoryContent({ params }: { params: Promise<{ slug: string }> }) {
  const category = await getCategoryBySlug((await params).slug);
  if (!category) notFound();
  const products = await getProductsByCategory(category.id);

  return (
    <>
      <PageTitle title={category.name} subtitle={category.name_urdu} backHref="/" backLabel="Home" />
      {products.length === 0 ? (
        <p className="rounded-2xl bg-muted p-6 text-center text-lg">No items in this category yet.</p>
      ) : (
        <ProductGrid products={products} />
      )}
    </>
  );
}
