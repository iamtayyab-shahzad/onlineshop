import type { Metadata } from "next";
import Link from "next/link";
import { adminDb } from "@/lib/auth";
import { AdminTitle, Card, Empty, PayBadge } from "@/components/admin/admin-ui";
import { OrderActionButtons } from "../order-buttons";
import { formatPrice } from "@/lib/format";
import { formatQty } from "@/lib/quantity";
import { OPEN_STATUSES, PAYMENT_LABEL, formatDate } from "@/lib/orders";

export const metadata: Metadata = { title: "In progress" };

/** Every order that is not delivered or cancelled yet. One tap completes or cancels it; Edit changes its items. */
export default async function InProgressPage() {
  const { supabase } = await adminDb();
  const { data } = await supabase
    .from("orders")
    .select(
      `id, order_number, created_at, delivery_name, delivery_phone, delivery_address, delivery_area, delivery_landmark,
       total, discount, payment_method, payment_status,
       order_items(id, product_name, quantity, unit_label, unit_name)`,
    )
    .in("status", [...OPEN_STATUSES])
    .order("created_at");

  if (!data?.length) {
    return (
      <div>
        <AdminTitle title="In progress" />
        <Empty>No open orders. New orders appear here.</Empty>
      </div>
    );
  }
  const amount = data.reduce((s, o) => s + Number(o.total), 0);
  return (
    <div className="flex flex-col gap-4">
      <AdminTitle title="In progress" />
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {data.length} open {data.length === 1 ? "order" : "orders"} to deliver
        </p>
        <p className="text-2xl font-bold tabular-nums">{formatPrice(amount)}</p>
        <p className="text-xs text-muted-foreground">
          When you complete or cancel an order, its amount is taken off this total.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data.map((o) => (
          <Card key={o.id}>
            <div className="flex items-start justify-between gap-2">
              <Link href={`/admin/orders/${o.id}`} className="text-lg font-bold text-primary">
                #{o.order_number}
              </Link>
              <div className="text-right">
                <span className="font-semibold tabular-nums">{formatPrice(o.total)}</span>
                {Number(o.discount) > 0 && (
                  <p className="text-xs text-muted-foreground">after {formatPrice(o.discount)} discount</p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
            <p className="mt-1 font-medium">{o.delivery_name}</p>
            <p className="text-sm">
              {o.delivery_address}, {o.delivery_area}
              {o.delivery_landmark ? ` (near ${o.delivery_landmark})` : ""}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <a href={`tel:${o.delivery_phone}`} className="font-semibold text-primary">
                Call {o.delivery_phone}
              </a>
              <span>· {PAYMENT_LABEL[o.payment_method]}</span>
              <PayBadge status={o.payment_status} />
            </div>
            <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
              {(o.order_items ?? []).slice(0, 6).map((i) => (
                <li key={i.id}>
                  {i.product_name} — {formatQty(Number(i.quantity), i.unit_name ?? i.unit_label)}
                </li>
              ))}
              {(o.order_items ?? []).length > 6 && <li>and {(o.order_items ?? []).length - 6} more…</li>}
            </ul>
            <div className="mt-3 flex flex-wrap items-start gap-2">
              <OrderActionButtons id={o.id} number={o.order_number} />
              <Link
                href={`/admin/orders/${o.id}/edit`}
                className="inline-flex h-10 items-center rounded-lg border-2 px-4 text-sm font-semibold"
              >
                Edit
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
