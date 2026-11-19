import type { Metadata } from "next";
import Link from "next/link";
import { adminDb } from "@/lib/auth";
import { AdminTitle, Empty, Table } from "@/components/admin/admin-ui";
import { formatDate } from "@/lib/orders";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase } = await adminDb();
  const { q } = await searchParams;
  let query = supabase
    .from("profiles")
    .select("id, full_name, phone, role, created_at, orders(count)")
    .order("created_at", { ascending: false })
    .limit(200);
  const term = q?.trim().replace(/[%,()]/g, "");
  if (term) query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term.replace(/\D/g, "").slice(-7) || term}%`);
  const { data } = await query;
  return (
    <div>
      <AdminTitle title="Customers" />
      <form className="mb-3 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Name or phone"
          className="h-10 w-full max-w-xs rounded-lg border-2 px-3"
        />
        <button className="h-10 rounded-lg border-2 px-4 text-sm font-semibold">Search</button>
      </form>
      {!data?.length ? (
        <Empty>No customers found.</Empty>
      ) : (
        <Table head={["Name", "Phone", "Orders", "Joined", ""]}>
          {data.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-2 font-medium">
                {c.full_name || "—"}
                {c.role === "admin" && (
                  <span className="ml-2 rounded bg-primary/10 px-1.5 text-xs text-primary">admin</span>
                )}
              </td>
              <td className="px-3 py-2">
                {c.phone ? (
                  <a href={`tel:${c.phone}`} className="text-primary">
                    {c.phone}
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2 tabular-nums">{c.orders?.[0]?.count ?? 0}</td>
              <td className="px-3 py-2 text-muted-foreground">{formatDate(c.created_at)}</td>
              <td className="px-3 py-2">
                {c.phone && (
                  <Link href={`/admin/orders?q=${encodeURIComponent(c.phone)}`} className="text-sm text-primary">
                    View orders
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
