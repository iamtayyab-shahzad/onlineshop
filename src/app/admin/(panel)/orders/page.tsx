import type { Metadata } from "next";
import Link from "next/link";
import { adminDb } from "@/lib/auth";
import { ADMIN_STATUS_LABEL, AdminTitle, Empty, PayBadge, StatusBadge, Table, pkDate } from "@/components/admin/admin-ui";
import { OrderSearch } from "./order-search";
import { formatPrice } from "@/lib/format";
import { ADMIN_STATUSES, OPEN_STATUSES, PAYMENT_LABEL, formatDate, type OrderStatus } from "@/lib/orders";
import { cleanSearch, dayRange, orderSearchFilter } from "@/lib/order-search";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

const FILTERS: (OrderStatus | "all")[] = ["all", ...ADMIN_STATUSES];
const LIMIT = 200;

type Params = { status?: string; q?: string; from?: string; to?: string };

function href(p: { status: string; q: string; from: string; to: string }) {
  const sp = new URLSearchParams();
  if (p.status !== "all") sp.set("status", p.status);
  if (p.q) sp.set("q", p.q);
  if (p.from) sp.set("from", p.from);
  if (p.to) sp.set("to", p.to);
  const s = sp.toString();
  return s ? `/admin/orders?${s}` : "/admin/orders";
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase } = await adminDb();
  const sp = await searchParams;
  const status = FILTERS.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus | "all") : "all";
  const q = cleanSearch(sp.q);
  const range = dayRange(sp.from, sp.to);
  const from = range?.from ?? "";
  const to = range ? (range.to === range.from && !sp.to ? "" : range.to) : "";

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, created_at, delivery_name, delivery_phone, delivery_area, total, status, payment_method, payment_status",
    )
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  // "New" also covers any older in-between status.
  if (status === "placed") query = query.in("status", [...OPEN_STATUSES]);
  else if (status !== "all") query = query.eq("status", status);
  const filter = orderSearchFilter(q);
  if (filter) query = query.or(filter);
  if (range) query = query.gte("created_at", range.gte).lt("created_at", range.lt);
  const { data: orders } = await query;

  const counted = (orders ?? []).filter((o) => o.status !== "cancelled");
  const sum = counted.reduce((s, o) => s + Number(o.total), 0);
  const today = pkDate();
  const presets = [
    { label: "Today", from: today, to: "" },
    { label: "Yesterday", from: pkDate(-1), to: "" },
    { label: "Last 7 days", from: pkDate(-6), to: today },
    { label: "This month", from: `${today.slice(0, 8)}01`, to: today },
  ];

  return (
    <div>
      <AdminTitle title="Orders" />
      <OrderSearch key={`${q}|${from}|${to}`} q={q} status={status} from={from} to={to} />
      <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
        {presets.map((p) => (
          <Link
            key={p.label}
            href={href({ status, q, from: p.from, to: p.to })}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-xs leading-8 font-medium",
              p.from === from && p.to === to ? "border-primary bg-primary/10 text-primary" : "bg-card",
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={href({ status: f, q, from, to })}
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
        <Empty>No orders found.</Empty>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">
            {orders.length >= LIMIT ? `Latest ${LIMIT} orders` : `${orders.length} ${orders.length === 1 ? "order" : "orders"}`}
            {range && ` · ${range.from === range.to ? formatRange(range.from) : `${formatRange(range.from)} to ${formatRange(range.to)}`}`}
            {" · "}
            <span className="font-semibold text-foreground">{formatPrice(sum)}</span> without cancelled orders
          </p>
          <Table head={["Order", "Customer", "Area", "Total", "Status", "Payment", ""]}>
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
                <td className="px-3 py-2">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-3 py-2">
                  <div className="text-xs">{PAYMENT_LABEL[o.payment_method]}</div>
                  <PayBadge status={o.payment_status} />
                </td>
                <td className="px-3 py-2">
                  <Link href={`/admin/orders/${o.id}/edit`} className="text-sm font-semibold text-primary">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </div>
  );
}

function formatRange(day: string): string {
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" }).format(
    new Date(`${day}T12:00:00+05:00`),
  );
}
