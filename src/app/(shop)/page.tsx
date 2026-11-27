import Link from "next/link";
import { Mic } from "lucide-react";
import { getCategories, getFeaturedProducts } from "@/lib/catalog";
import { SearchBox } from "@/components/search-box";
import { ProductGrid } from "@/components/product-card";
import { InstallApp } from "@/components/install-app";

export default async function HomePage() {
  const [categories, featured] = await Promise.all([getCategories(), getFeaturedProducts()]);

  return (
    <div className="flex flex-col gap-6">
      <SearchBox />

      <Link
        href="/voice-order"
        className="flex min-h-20 items-center gap-4 rounded-2xl border-2 border-primary bg-secondary p-4 active:opacity-80"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Mic className="size-6" aria-hidden />
        </span>
        <span>
          <span className="block text-lg font-bold">Order by voice</span>
          <span className="block text-sm text-muted-foreground">Just say your list. We will call you to confirm.</span>
        </span>
      </Link>

      <InstallApp place="home" />

      <section aria-labelledby="cat-heading">
        <h2 id="cat-heading" className="mb-3 text-xl font-bold">
          Shop by category
        </h2>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/category/${c.slug}`}
                className="flex h-full min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border bg-card p-2 text-center active:bg-secondary"
              >
                <span className="text-4xl" aria-hidden>
                  {c.icon}
                </span>
                <span className="text-sm leading-tight font-semibold">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {featured.length > 0 && (
        <section aria-labelledby="popular-heading">
          <h2 id="popular-heading" className="mb-3 text-xl font-bold">
            Popular items
          </h2>
          <ProductGrid products={featured} />
        </section>
      )}
    </div>
  );
}
