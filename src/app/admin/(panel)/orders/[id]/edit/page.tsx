import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/auth";
import { AdminTitle, Card } from "@/components/admin/admin-ui";
import { updateOrder } from "@/app/admin/_actions/order-edit";
import { OrderEditor } from "../../order-editor";
import { isUuid } from "@/lib/admin-types";
import { formatDate } from "@/lib/orders";

export const metadata: Metadata = { title: "Edit order" };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase } = await adminDb();
  const { data: o } = await supabase
    .from("orders")
    .select(
      `id, order_number, status, created_at, delivery_name, delivery_phone, delivery_area, delivery_fee, discount,
       order_items(id, product_id, product_name, unit_label, unit_price, quantity, created_at)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();

  const items = [...(o.order_items ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <AdminTitle title={`Edit order #${o.order_number}`} backHref={`/admin/orders/${o.id}`} />
      <Card>
        <p className="font-semibold">{o.delivery_name}</p>
        <p className="text-sm text-muted-foreground">
          {o.delivery_phone} · {o.delivery_area} · placed {formatDate(o.created_at)}
        </p>
        {(o.status === "delivered" || o.status === "cancelled") && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
            This order is already {o.status}. Changes will update its amount in your reports.
          </p>
        )}
      </Card>
      <OrderEditor
        action={updateOrder}
        hidden={{ order_id: o.id }}
        submit="Save changes"
        initialItems={items.map((i) => ({
          id: i.id,
          product_id: i.product_id ?? undefined,
          name: i.product_name,
          unit_label: i.unit_label,
          unit_price: Number(i.unit_price),
          quantity: Number(i.quantity),
        }))}
        initialDiscount={Number(o.discount)}
        initialFee={Number(o.delivery_fee)}
        initialNote=""
      />
    </div>
  );
}
