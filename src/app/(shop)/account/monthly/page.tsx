import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageTitle } from "@/components/page-title";
import { BlockSkeleton } from "@/components/skeletons";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProductsByIds } from "@/lib/catalog";
import { toCartItem } from "@/lib/catalog-item";
import { MonthlyListView, type MonthlyEntry } from "./monthly-list";

export const metadata: Metadata = { title: "My Monthly List" };

export default function MonthlyPage() {
  return (
    <>
      <PageTitle title="My Monthly List" backHref="/account" backLabel="My account" />
      <Suspense fallback={<BlockSkeleton />}>
        <MonthlyContent />
      </Suspense>
    </>
  );
}

async function MonthlyContent() {
  const user = await requireUser("/account/monthly");
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("monthly_list_items")
    .select("product_id, quantity, amount, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-muted p-6 text-center">
        <p className="text-lg font-semibold">Your list is empty</p>
        <p className="text-base text-muted-foreground">
          Save the things you buy every month. Next time, add them all to your cart with one tap.
          Open any product and tap “Save to my monthly list”, or save your whole cart.
        </p>
        <Link
          href="/"
          className="mx-auto mt-2 inline-flex h-12 items-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  const products = await getProductsByIds(rows.map((r) => r.product_id));
  const entries: MonthlyEntry[] = rows.map((r) => {
    const p = products.find((x) => x.id === r.product_id);
    const available = !!p && p.in_stock && p.selling_price > 0;
    return {
      productId: r.product_id,
      qty: Number(r.quantity),
      amount: r.amount,
      item: p && available ? toCartItem(p) : null,
      name: p?.name ?? "This item",
    };
  });

  return <MonthlyListView entries={entries} />;
}
