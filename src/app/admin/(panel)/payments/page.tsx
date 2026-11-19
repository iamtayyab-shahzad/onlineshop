import type { Metadata } from "next";
import Link from "next/link";
import { adminDb } from "@/lib/auth";
import { AdminTitle, Card, Empty, LinkButton } from "@/components/admin/admin-ui";
import { ProofReview } from "./proof-review";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Payments" };

const COLS =
  "id, method, amount, transaction_ref, screenshot_path, status, admin_note, created_at, orders(id, order_number, total, delivery_name)";

export default async function PaymentsPage() {
  const { supabase } = await adminDb();
  const [{ data: proofs }, { data: recent }] = await Promise.all([
    supabase.from("payment_proofs").select(COLS).eq("status", "submitted").order("created_at"),
    supabase
      .from("payment_proofs")
      .select(COLS)
      .neq("status", "submitted")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const block = (list: typeof proofs) =>
    list?.map((p) => (
      <Card key={p.id}>
        {p.orders && (
          <p className="mb-2 text-sm">
            <Link href={`/admin/orders/${p.orders.id}`} className="font-semibold text-primary">
              Order #{p.orders.order_number}
            </Link>
            {` · ${p.orders.delivery_name} · order total ${formatPrice(p.orders.total)}`}
          </p>
        )}
        <ProofReview proof={p} />
      </Card>
    ));
  return (
    <div className="flex flex-col gap-4">
      <AdminTitle title="Payments to check">
        <LinkButton href="/admin/settings#payments" variant="outline">
          Payment accounts &amp; QR codes
        </LinkButton>
      </AdminTitle>
      <p className="text-sm text-muted-foreground">
        Open your JazzCash / Easypaisa / bank app and find the transaction ID and amount before marking an order paid.
      </p>
      {proofs?.length ? block(proofs) : <Empty>No payments waiting.</Empty>}
      {!!recent?.length && (
        <>
          <h2 className="mt-4 text-lg font-bold">Recently checked</h2>
          {block(recent)}
        </>
      )}
    </div>
  );
}
