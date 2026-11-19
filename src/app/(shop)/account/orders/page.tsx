import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { BlockSkeleton } from "@/components/skeletons";
import { requireUser } from "@/lib/auth";
import { getMyOrders } from "@/lib/account";
import { formatPrice } from "@/lib/format";
import { STATUS_LABEL, formatDate } from "@/lib/orders";

export const metadata: Metadata = { title: "My orders" };

export default function OrdersPage() {
  return (
    <>
      <PageTitle title="My orders" backHref="/account" backLabel="My account" />
      <Suspense fallback={<BlockSkeleton />}>
        <OrderList />
      </Suspense>
    </>
  );
}

async function OrderList() {
  const user = await requireUser("/account/orders");
  const orders = await getMyOrders(user.id);

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl bg-muted p-8 text-center">
        <p className="text-lg font-semibold">No orders yet</p>
        <Link
          href="/"
          className="mt-4 inline-flex h-12 items-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {orders.map((o) => {
        const count = o.order_items[0]?.count ?? 0;
        return (
          <li key={o.id}>
            <Link href={`/account/orders/${o.id}`} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
              <span className="flex-1">
                <span className="block text-lg font-semibold">{o.order_number}</span>
                <span className="block text-sm text-muted-foreground">
                  {formatDate(o.created_at)} · {count} {count === 1 ? "item" : "items"}
                </span>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-sm font-medium ${
                    o.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-secondary text-primary"
                  }`}
                >
                  {STATUS_LABEL[o.status]}
                </span>
              </span>
              <span className="text-lg font-bold tabular-nums">{formatPrice(o.total)}</span>
              <ChevronRight className="size-6 text-muted-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
