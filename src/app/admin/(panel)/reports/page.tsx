import type { Metadata } from "next";
import { adminDb } from "@/lib/auth";
import { AdminTitle, Empty, Stat, Table, inputCls, pkDate } from "@/components/admin/admin-ui";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Reports" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { supabase } = await adminDb();
  const sp = await searchParams;
  const from = sp.from && DATE.test(sp.from) ? sp.from : pkDate(-29);
  const to = sp.to && DATE.test(sp.to) ? sp.to : pkDate();
  const { data, error } = await supabase.rpc("admin_sales_report", { p_from: from, p_to: to });
  const rows = data ?? [];
  const sum = rows.reduce(
    (a, r) => ({
      orders: a.orders + Number(r.orders),
      sales: a.sales + Number(r.sales),
      cost: a.cost + Number(r.supplier_cost),
      profit: a.profit + Number(r.profit),
    }),
    { orders: 0, sales: 0, cost: 0, profit: 0 },
  );
  return (
    <div className="flex flex-col gap-4">
      <AdminTitle title="Reports" />
      <form className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          From
          <input type="date" name="from" defaultValue={from} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          To
          <input type="date" name="to" defaultValue={to} className={inputCls} />
        </label>
        <button className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Show</button>
      </form>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Orders" value={sum.orders} />
        <Stat label="Sales (items)" value={formatPrice(sum.sales)} />
        <Stat label="Supplier cost" value={formatPrice(sum.cost)} />
        <Stat label="Profit" value={formatPrice(sum.profit)} />
      </div>
      {error ? (
        <Empty>Could not load the report.</Empty>
      ) : !rows.length ? (
        <Empty>No orders in these dates.</Empty>
      ) : (
        <Table head={["Day", "Orders", "Sales", "Supplier cost", "Profit"]}>
          {rows.map((r) => (
            <tr key={r.day}>
              <td className="px-3 py-2">{r.day}</td>
              <td className="px-3 py-2 tabular-nums">{r.orders}</td>
              <td className="px-3 py-2 tabular-nums">{formatPrice(Number(r.sales))}</td>
              <td className="px-3 py-2 tabular-nums">{formatPrice(Number(r.supplier_cost))}</td>
              <td className="px-3 py-2 font-semibold tabular-nums">{formatPrice(Number(r.profit))}</td>
            </tr>
          ))}
        </Table>
      )}
      <p className="text-xs text-muted-foreground">Cancelled orders are not counted. Dates are Pakistan time.</p>
    </div>
  );
}
