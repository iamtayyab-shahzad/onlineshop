import type { Metadata } from "next";
import Link from "next/link";
import { adminDb } from "@/lib/auth";
import { ADMIN_STATUS_LABEL, AdminTitle, Empty, PayBadge, StatusBadge, Table } from "@/components/admin/admin-ui";
import { formatPrice } from "@/lib/format";
import { PAYMENT_LABEL, formatDate, type OrderStatus } from "@/lib/orders";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

const FILTERS: (OrderStatus | "all")[] = ["all", "placed", "confirmed", "sent_to_shop", "packed", "out_for_delivery", "delivered", "cancelled"];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { supabase } = await adminDb();
  const { status: raw, q } = await searchParams;
  const status = FILTERS.includes(raw as OrderStatus) ? (raw as OrderStatus | "all") : "all";
  let query = supabase
    .from("orders")
    .select("id, order_number, created_at, delivery_name, delivery_phone, delivery_area, total, status, payment_method, payment_status")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status !== "all") query = query.eq("status", status);
  const num = Number(q?.replace(/\D/g, ""));
  if (q && num) query = q.trim().startsWith("#") || q.length < 7 ? query.eq("order_number", num) : query.ilike("delivery_phone", `%${q.replace(/\D/g, "").slice(-7)}%`);
  const { data: orders } = await query;

  return (
    <div>
      <AdminTitle title="Orders" />
      <form className="mb-3 flex gap-2">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Order # or phone" className="h-10 w-full max-w-xs rounded-lg border-2 px-3" />
        <button className="h-10 rounded-lg border-2 px-4 text-sm font-semibold">Search</button>
      </form>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/admin/orders" : `/admin/orders?status=${f}`}
            className={cn(
              "h-9 shrink-0 rounded-full border px-3 text-sm leading-9 font-medium",
              f === status ? "border-primary bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            {f === "all" ? "All" : ADMIN_STATUS_LABEL[f]}
          </Link>
        ))}
      </div>
      {!orders?.length ? (
        <Empty>No orders here.</Empty>
      ) : (
        <Table head={["Order", "Customer", "Area", "Total", "Status", "Payment"]}>
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-muted/40">
              <td className="px-3 py-2">
                <Link href={`/admin/orders/${o.id}`} className="font-semibold text-primary">
                  #{o.order_number}
                </Link>
                <div className="text-xs text-muted-foreground">{formatDate(o.created_at)}</div>
              </td>
              <td className="px-3 py-2">
                {o.delivery_name}
                <div className="text-xs text-muted-foreground">{o.delivery_phone}</div>
              </td>
              <td className="px-3 py-2">{o.delivery_area}</td>
              <td className="px-3 py-2 font-semibold tabular-nums">{formatPrice(o.total)}</td>
              <td className="px-3 py-2"><StatusBadge status={o.status} /></td>
              <td className="px-3 py-2">
                <div className="text-xs">{PAYMENT_LABEL[o.payment_method]}</div>
                <PayBadge status={o.payment_status} />
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
