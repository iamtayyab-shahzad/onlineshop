import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/auth";
import { ActionForm, CopyButton } from "@/components/admin/action-form";
import {
  ADMIN_STATUS_LABEL,
  AdminTitle,
  Card,
  LinkButton,
  PayBadge,
  Select,
  StatusBadge,
  inputCls,
} from "@/components/admin/admin-ui";
import { setOrderStatus, setPaymentStatus } from "@/app/admin/_actions/orders";
import { resendNotification } from "@/app/admin/_actions/notifications";
import { OrderActionButtons } from "../../order-buttons";
import { ProofReview } from "../../payments/proof-review";
import { formatPrice } from "@/lib/format";
import { formatQty } from "@/lib/quantity";
import { ADMIN_STATUSES, PAYMENT_LABEL, formatDate, isOpenStatus } from "@/lib/orders";
import { isUuid } from "@/lib/admin-types";

export const metadata: Metadata = { title: "Order" };

const NOTIFY_LABEL: Record<string, string> = {
  pending: "Waiting to be sent",
  sending: "Sending…",
  sent: "Sent",
  failed: "Failed",
};

const waLink = (phone: string | null | undefined, msg: string) => {
  const d = (phone ?? "").replace(/\D/g, "").replace(/^0/, "92");
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(msg)}` : null;
};

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase } = await adminDb();
  const [{ data: o }, { data: shop }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `*,
         order_items(id, product_name, quantity, unit_label, unit_name, unit_price, line_total, amount_requested,
           order_item_costs(supplier_unit_price, supplier_line_total)),
         payment_proofs(id, method, amount, transaction_ref, screenshot_path, status, admin_note, created_at),
         order_notifications(id, recipient, status, attempts, last_error, sent_at),
         order_status_events(id, status, note, created_at)`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("shops").select("name, whatsapp_phone").eq("is_default", true).maybeSingle(),
  ]);
  if (!o) notFound();

  const items = o.order_items ?? [];
  const cost = items.reduce((s, i) => s + Number(i.order_item_costs?.supplier_line_total ?? 0), 0);
  const missingCost = items.some((i) => !i.order_item_costs);
  const discount = Number(o.discount);
  const profit = Number(o.subtotal) - discount - cost;
  const open = isOpenStatus(o.status);
  const qty = (i: (typeof items)[number]) => formatQty(Number(i.quantity), i.unit_name ?? i.unit_label);

  // Packing list for the shop: names and quantities only, never prices.
  const packing = [
    `Order #${o.order_number}`,
    ...items.map((i) => `• ${i.product_name} — ${qty(i)}${i.amount_requested ? ` (Rs ${i.amount_requested} worth)` : ""}`),
    o.customer_note ? `Note: ${o.customer_note}` : "",
    `Area: ${o.delivery_area}`,
  ]
    .filter(Boolean)
    .join("\n");
  const shopWa = waLink(shop?.whatsapp_phone, packing);
  const custWa = waLink(o.delivery_phone, `Assalam o Alaikum ${o.delivery_name}, about your order #${o.order_number}: `);
  const events = [...(o.order_status_events ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const proofs = [...(o.payment_proofs ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="flex flex-col gap-4">
      <AdminTitle title={`Order #${o.order_number}`} backHref="/admin/orders">
        <StatusBadge status={o.status} />
        <PayBadge status={o.payment_status} />
        <LinkButton href={`/admin/orders/${o.id}/edit`} variant="outline">
          Edit order
        </LinkButton>
      </AdminTitle>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Items" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="py-1">Item</th>
                  <th>Qty</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Supplier</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2 font-medium">
                      {i.product_name}
                      {i.amount_requested && (
                        <div className="text-xs text-muted-foreground">Asked for Rs {i.amount_requested} worth</div>
                      )}
                    </td>
                    <td>{qty(i)}</td>
                    <td className="text-right tabular-nums">{formatPrice(i.unit_price)}</td>
                    <td className="text-right font-semibold tabular-nums">{formatPrice(i.line_total)}</td>
                    <td className="text-right text-muted-foreground tabular-nums">
                      {i.order_item_costs ? formatPrice(i.order_item_costs.supplier_line_total) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-1 border-t pt-3 text-sm">
            <dt>Subtotal</dt>
            <dd className="text-right tabular-nums">{formatPrice(o.subtotal)}</dd>
            <dt>Delivery</dt>
            <dd className="text-right tabular-nums">{formatPrice(o.delivery_fee)}</dd>
            {discount > 0 && (
              <>
                <dt>Discount</dt>
                <dd className="text-right tabular-nums">− {formatPrice(discount)}</dd>
              </>
            )}
            <dt className="font-bold">Customer pays</dt>
            <dd className="text-right font-bold tabular-nums">{formatPrice(o.total)}</dd>
            <dt className="text-muted-foreground">Supplier cost</dt>
            <dd className="text-right text-muted-foreground tabular-nums">{formatPrice(cost)}</dd>
            <dt className="font-semibold text-primary">Profit (items)</dt>
            <dd className="text-right font-semibold text-primary tabular-nums">{formatPrice(profit)}</dd>
          </dl>
          {missingCost && (
            <p className="mt-2 text-xs text-amber-700">
              Some items had no supplier price when ordered, so profit is approximate.
            </p>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Customer">
            <p className="font-semibold">{o.delivery_name}</p>
            <a href={`tel:${o.delivery_phone}`} className="text-primary">
              {o.delivery_phone}
            </a>
            <p className="mt-1 text-sm">
              {o.delivery_address}, {o.delivery_area}
            </p>
            {o.delivery_landmark && <p className="text-sm text-muted-foreground">Near {o.delivery_landmark}</p>}
            {o.customer_note && (
              <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Note: {o.customer_note}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Placed {formatDate(o.created_at)} · {o.source}
            </p>
            {custWa && (
              <a
                href={custWa}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex h-10 items-center rounded-lg border-2 px-4 text-sm font-semibold"
              >
                WhatsApp customer
              </a>
            )}
          </Card>

          <Card title="Status">
            <div className="flex flex-col gap-3">
              {open && <OrderActionButtons id={o.id} number={o.order_number} />}
              <ActionForm action={setOrderStatus} submit="Save status">
                <input type="hidden" name="order_id" value={o.id} />
                <Select
                  label={open ? "Change to" : "Move back to"}
                  name="status"
                  defaultValue={open ? "placed" : o.status}
                  options={ADMIN_STATUSES.map((s) => ({
                    value: s,
                    label: ADMIN_STATUS_LABEL[s],
                  }))}
                />
                <input name="note" placeholder="Note (optional)" maxLength={300} className={inputCls} />
              </ActionForm>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Send to shop (WhatsApp)">
          <pre className="mb-3 rounded-lg bg-muted p-3 font-sans text-sm whitespace-pre-wrap">{packing}</pre>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={packing} label="Copy list" />
            {shopWa ? (
              <a
                href={shopWa}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Open WhatsApp to {shop?.name ?? "shop"}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">Add the shop WhatsApp number in Settings to open it directly.</p>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Prices are not included.</p>
        </Card>

        <Card title={`Payment · ${PAYMENT_LABEL[o.payment_method]}`}>
          {proofs.length === 0 && o.payment_method !== "cod" && (
            <p className="mb-3 text-sm text-muted-foreground">No payment proof sent yet.</p>
          )}
          <div className="mb-3 flex flex-col gap-3">
            {proofs.map((p) => (
              <ProofReview key={p.id} proof={p} />
            ))}
          </div>
          <ActionForm action={setPaymentStatus} submit="Update payment" inline>
            <input type="hidden" name="order_id" value={o.id} />
            <select name="payment_status" defaultValue={o.payment_status} className={inputCls + " w-auto"}>
              <option value="unpaid">Unpaid</option>
              <option value="pending_verification">Check payment</option>
              <option value="paid">Paid</option>
              <option value="refunded">Refunded</option>
            </select>
          </ActionForm>
          <p className="mt-2 text-xs text-muted-foreground">
            Mark paid only after you see the money in your account. A screenshot alone is not proof.
          </p>
        </Card>
      </div>

      {(o.order_notifications ?? []).length > 0 && (
        <Card title="Automatic WhatsApp alerts">
          <ul className="flex flex-col gap-3">
            {(["admin", "shop"] as const).map((r) => {
              const n = (o.order_notifications ?? []).find((x) => x.recipient === r);
              if (!n) return null;
              return (
                <li key={r} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-semibold">
                      {r === "admin" ? "To you (customer details and selling prices)" : "To the shop (supplier prices only)"}
                    </p>
                    <p className={n.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                      {NOTIFY_LABEL[n.status] ?? n.status}
                      {n.status === "sent" && n.sent_at ? ` · ${formatDate(n.sent_at)}` : ""}
                      {n.attempts > 1 ? ` · ${n.attempts} tries` : ""}
                      {n.last_error ? ` · ${n.last_error}` : ""}
                    </p>
                  </div>
                  <ActionForm action={resendNotification} submit={n.status === "sent" ? "Send again" : "Send now"} inline>
                    <input type="hidden" name="order_id" value={o.id} />
                    <input type="hidden" name="recipient" value={r} />
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card title="History">
        <ol className="flex flex-col gap-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-2">
              <span className="font-semibold">{ADMIN_STATUS_LABEL[e.status]}</span>
              <span className="text-muted-foreground">{formatDate(e.created_at)}</span>
              {e.note && <span>— {e.note}</span>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
