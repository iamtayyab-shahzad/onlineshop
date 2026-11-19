import type { Metadata } from "next";
import { adminDb } from "@/lib/auth";
import { Card, LinkButton, Stat, pkDate } from "@/components/admin/admin-ui";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase } = await adminDb();
  const today = pkDate();
  const [newOrders, active, pay, voice, report] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "placed"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["confirmed", "sent_to_shop", "packed", "out_for_delivery"]),
    supabase.from("payment_proofs").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("voice_orders").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.rpc("admin_sales_report", { p_from: today, p_to: today }),
  ]);
  const t = (report.data ?? []).reduce(
    (a, r) => ({ orders: a.orders + Number(r.orders), sales: a.sales + Number(r.sales), profit: a.profit + Number(r.profit) }),
    { orders: 0, sales: 0, profit: 0 },
  );
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="New orders" value={newOrders.count ?? 0} href="/admin/orders?status=placed" tone={newOrders.count ? "warn" : undefined} />
        <Stat label="In progress" value={active.count ?? 0} href="/admin/deliveries" />
        <Stat label="Payments to check" value={pay.count ?? 0} href="/admin/payments" tone={pay.count ? "warn" : undefined} />
        <Stat label="New voice orders" value={voice.count ?? 0} href="/admin/voice" tone={voice.count ? "warn" : undefined} />
      </div>
      <Card title="Today">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Orders" value={t.orders} />
          <Stat label="Sales" value={formatPrice(t.sales)} />
          <Stat label="Profit" value={formatPrice(t.profit)} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Cancelled orders are not counted.</p>
      </Card>
      <div className="flex flex-wrap gap-2">
        <LinkButton href="/admin/products/new">Add product</LinkButton>
        <LinkButton href="/admin/images" variant="outline">Upload images</LinkButton>
        <LinkButton href="/admin/settings" variant="outline">Payment accounts</LinkButton>
        <LinkButton href="/admin/reports" variant="outline">Reports</LinkButton>
      </div>
    </div>
  );
}
