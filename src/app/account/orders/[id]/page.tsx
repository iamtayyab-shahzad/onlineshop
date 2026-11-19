import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { BlockSkeleton } from "@/components/skeletons";
import { requireUser } from "@/lib/auth";
import { getMyOrder } from "@/lib/account";
import { formatPrice } from "@/lib/format";
import { PAYMENT_LABEL, PAYMENT_STATUS_LABEL, STATUS_LABEL, STATUS_STEPS, formatDate } from "@/lib/orders";
import { formatPkMobile } from "@/lib/phone";
import { ReorderButton } from "./reorder-button";

export const metadata: Metadata = { title: "Order details" };

export default function OrderPage({ params }: PageProps<"/account/orders/[id]">) {
  return (
    <>
      <PageTitle title="Order details" backHref="/account/orders" backLabel="My orders" />
      <Suspense fallback={<BlockSkeleton />}>
        <OrderDetail params={params} />
      </Suspense>
    </>
  );
}

async function OrderDetail({ params }: { params: PageProps<"/account/orders/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser(`/account/orders/${encodeURIComponent(id)}`);
  const order = await getMyOrder(user.id, id);
  if (!order) notFound();

  const reached = new Map(order.order_status_events.map((e) => [e.status, e.created_at]));
  const cancelled = order.status === "cancelled";
  const currentStep = STATUS_STEPS.indexOf(order.status as (typeof STATUS_STEPS)[number]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-xl font-bold">{order.order_number}</p>
        <p className="text-sm text-muted-foreground">Placed {formatDate(order.created_at)}</p>
        <p className={`mt-2 text-lg font-semibold ${cancelled ? "text-destructive" : "text-primary"}`}>
          {STATUS_LABEL[order.status]}
        </p>
      </div>

      {!cancelled && (
        <section aria-label="Order progress" className="rounded-2xl border bg-card p-4">
          <ol className="flex flex-col gap-3">
            {STATUS_STEPS.map((s, i) => {
              const done = i <= currentStep;
              const at = reached.get(s);
              return (
                <li key={s} className="flex items-center gap-3">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${
                      done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                    }`}
                  >
                    {done && <Check className="size-5" />}
                  </span>
                  <span className={done ? "text-base font-semibold" : "text-base text-muted-foreground"}>
                    {STATUS_LABEL[s]}
                    {at && <span className="block text-sm font-normal text-muted-foreground">{formatDate(at)}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section aria-label="Items" className="rounded-2xl border bg-card p-4">
        <ul className="flex flex-col gap-2">
          {order.order_items.map((it) => (
            <li key={it.id} className="flex justify-between gap-3 text-base">
              <span>
                {it.product_name}
                <span className="block text-sm text-muted-foreground">
                  {it.quantity} × {formatPrice(it.unit_price)} · {it.unit_label}
                </span>
              </span>
              <span className="font-semibold tabular-nums">{formatPrice(it.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 flex flex-col gap-1 border-t pt-3 text-base">
          <div className="flex justify-between">
            <dt>Items</dt>
            <dd className="tabular-nums">{formatPrice(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Delivery</dt>
            <dd className="tabular-nums">{formatPrice(order.delivery_fee)}</dd>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPrice(order.total)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border bg-card p-4 text-base">
        <h2 className="mb-1 font-bold">Delivery to</h2>
        <p>
          {order.delivery_name} · {formatPkMobile(order.delivery_phone)}
        </p>
        <p>
          {order.delivery_address}, {order.delivery_area}
        </p>
        {order.delivery_landmark && <p className="text-muted-foreground">Near: {order.delivery_landmark}</p>}
        <h2 className="mt-3 mb-1 font-bold">Payment</h2>
        <p>
          {PAYMENT_LABEL[order.payment_method]} · {PAYMENT_STATUS_LABEL[order.payment_status]}
        </p>
        {order.customer_note && (
          <>
            <h2 className="mt-3 mb-1 font-bold">Your note</h2>
            <p className="break-words">{order.customer_note}</p>
          </>
        )}
      </section>

      <ReorderButton items={order.order_items.map((it) => ({ id: it.product_id, qty: it.quantity }))} />
    </div>
  );
}
