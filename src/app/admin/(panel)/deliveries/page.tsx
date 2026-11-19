import type { Metadata } from "next";
import Link from "next/link";
import { adminDb } from "@/lib/auth";
import { ADMIN_STATUS_LABEL, AdminTitle, Card, Empty, PayBadge } from "@/components/admin/admin-ui";
import { NextStepButton } from "../order-buttons";
import { formatPrice } from "@/lib/format";
import { PAYMENT_LABEL, type OrderStatus } from "@/lib/orders";

export const metadata: Metadata = { title: "Deliveries" };

const GROUPS: OrderStatus[] = ["placed", "confirmed", "sent_to_shop", "packed", "out_for_delivery"];

/** Everything not yet delivered, grouped by step, with a one-tap button to move each order on. */
export default async function DeliveriesPage() {
  const { supabase } = await adminDb();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, delivery_name, delivery_phone, delivery_address, delivery_area, delivery_landmark, total, status, payment_method, payment_status",
    )
    .in("status", GROUPS)
    .order("created_at");
  if (!data?.length) {
    return (
      <div>
        <AdminTitle title="Deliveries" />
        <Empty>No open orders.</Empty>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <AdminTitle title="Deliveries" />
      {GROUPS.map((g) => {
        const list = data.filter((o) => o.status === g);
        if (!list.length) return null;
        return (
          <section key={g}>
            <h2 className="mb-2 text-lg font-bold">
              {ADMIN_STATUS_LABEL[g]} ({list.length})
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((o) => (
                <Card key={o.id}>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/admin/orders/${o.id}`} className="text-lg font-bold text-primary">
                      #{o.order_number}
                    </Link>
                    <span className="font-semibold tabular-nums">{formatPrice(o.total)}</span>
                  </div>
                  <p className="font-medium">{o.delivery_name}</p>
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
                  <div className="mt-3">
                    <NextStepButton id={o.id} status={o.status} />
                  </div>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
