import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { searchProducts, toSearchWords } from "@/lib/catalog";
import { SearchBox } from "@/components/search-box";
import { ProductGrid } from "@/components/product-card";
import { ProductGridSkeleton } from "@/components/skeletons";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">Search products</h1>
      <Suspense fallback={<SearchBox />}>
        <SearchForm searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<ProductGridSkeleton />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type SP = Promise<Record<string, string | string[] | undefined>>;

async function readQuery(searchParams: SP) {
  const raw = (await searchParams).q;
  return (Array.isArray(raw) ? raw[0] : raw ?? "").slice(0, 60).trim();
}

async function SearchForm({ searchParams }: { searchParams: SP }) {
  const q = await readQuery(searchParams);
  return <SearchBox defaultValue={q} autoFocus={!q} />;
}

async function SearchResults({ searchParams }: { searchParams: SP }) {
  const q = await readQuery(searchParams);

  if (toSearchWords(q).length === 0) {
    return (
      <p className="text-lg text-muted-foreground">
        Type the name of an item, for example <strong>atta</strong>, <strong>chawal</strong> or{" "}
        <strong>daal</strong>. You can also search in Urdu.
      </p>
    );
  }

  const results = await searchProducts(q);

  if (results.length === 0) {
    return (
      <div className="rounded-2xl bg-muted p-6 text-center">
        <p className="text-lg font-semibold">Nothing found for “{q}”</p>
        <p className="mt-1 text-base text-muted-foreground">Try a shorter word, or browse the categories.</p>
        <Link
          href="/"
          className="mt-4 inline-flex h-12 items-center rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground"
        >
          See all categories
        </Link>
      </div>
    );
  }

  return (
    <section aria-label="Search results">
      <p className="mb-3 text-base text-muted-foreground">
        {results.length} {results.length === 1 ? "item" : "items"} found
      </p>
      <ProductGrid products={results} />
    </section>
  );
}
