import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { formatPrice } from "@/lib/format";
import { PAYMENT_LABEL, formatDate, type PaymentMethod } from "@/lib/orders";
import { formatQty } from "@/lib/quantity";
import { normalizeWhatsapp, sendWhatsapp, wahaConfigured } from "@/lib/waha";

/**
 * Automatic WhatsApp alerts for a new order: one to the admin (customer details + selling
 * prices) and one to the shop (names, quantities and SUPPLIER prices only).
 *
 * The message data comes from database functions that only answer a server holding
 * NOTIFY_SECRET, and each function returns only what that one recipient may see.
 * Nothing here can break an order: every failure is caught, saved on the notification
 * row (so it can be retried from the admin panel) and never thrown.
 */

export type Recipient = "admin" | "shop";
export type NotifyOutcome = "sent" | "failed" | "skipped" | "unavailable";

type Db = SupabaseClient<Database>;
type Line = {
  name: string;
  qty: number;
  unit: string | null;
  amount_requested: number | null;
  unit_price?: number;
  line_total?: number;
  supplier_unit_price?: number | null;
  supplier_line_total?: number | null;
};
type AdminPayload = {
  order_number: number;
  placed_at: string;
  customer_name: string;
  customer_phone: string;
  area: string;
  address: string;
  landmark: string | null;
  note: string | null;
  payment_method: PaymentMethod;
  subtotal: number;
  delivery_fee: number;
  total: number;
  items: Line[];
};
type ShopPayload = { order_number: number; items: Line[]; supplier_total: number; missing_prices: number };

const qtyText = (i: Line) => formatQty(Number(i.qty), i.unit);
const worth = (i: Line) => (i.amount_requested ? ` (Rs ${Number(i.amount_requested)} worth)` : "");

/** Joins message lines: `false` lines are dropped, "" is a blank spacer (never doubled, never first or last). */
function compose(lines: (string | false)[]): string {
  const out: string[] = [];
  for (const l of lines) {
    if (l === false) continue;
    if (l === "" && (out.length === 0 || out[out.length - 1] === "")) continue;
    out.push(l);
  }
  while (out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

function adminMessage(p: AdminPayload): string {
  return compose([
    `🛒 New order #${p.order_number}`,
    `${formatDate(p.placed_at)} · ${PAYMENT_LABEL[p.payment_method] ?? p.payment_method}`,
    "",
    `👤 ${p.customer_name}`,
    `📞 ${p.customer_phone}`,
    `📍 ${p.address}, ${p.area}`,
    p.landmark ? `Near ${p.landmark}` : false,
    p.note ? `📝 Note: ${p.note}` : false,
    "",
    "Items",
    ...p.items.map(
      (i) =>
        `• ${i.name} — ${qtyText(i)}${worth(i)} × ${formatPrice(Number(i.unit_price))} = ${formatPrice(Number(i.line_total))}`,
    ),
    "",
    `Subtotal: ${formatPrice(Number(p.subtotal))}`,
    `Delivery: ${formatPrice(Number(p.delivery_fee))}`,
    `Customer total: ${formatPrice(Number(p.total))}`,
  ]);
}

function shopMessage(p: ShopPayload): string {
  return compose([
    `📦 Order #${p.order_number}`,
    "",
    ...p.items.map((i) =>
      i.supplier_unit_price == null
        ? `• ${i.name} — ${qtyText(i)}${worth(i)} (price not set)`
        : `• ${i.name} — ${qtyText(i)}${worth(i)} × ${formatPrice(Number(i.supplier_unit_price))} = ${formatPrice(Number(i.supplier_line_total))}`,
    ),
    "",
    p.missing_prices > 0 ? `⚠️ ${p.missing_prices} item(s) have no supplier price.` : false,
    `Supplier total: ${formatPrice(Number(p.supplier_total))}`,
  ]);
}

const fallbackNumber = (r: Recipient) =>
  normalizeWhatsapp(r === "admin" ? process.env.ORDER_ADMIN_WHATSAPP : process.env.ORDER_SHOP_WHATSAPP);

async function sendOne(db: Db, orderId: string, recipient: Recipient, secret: string, force: boolean): Promise<NotifyOutcome> {
  const { data, error } = await db.rpc("claim_order_notification", {
    p_order_id: orderId,
    p_recipient: recipient,
    p_secret: secret,
    p_force: force,
  });
  if (error) {
    console.error("claim_order_notification failed", recipient, error.code, error.message);
    return "unavailable";
  }
  if (!data) return "skipped"; // already sent, or another request is sending it

  const { to, payload } = data as unknown as { to: string | null; payload: AdminPayload | ShopPayload };
  let ok = false;
  let reason = "";
  try {
    const number = normalizeWhatsapp(to) ?? fallbackNumber(recipient);
    if (!number) throw new Error("No WhatsApp number is set for this recipient");
    const text = recipient === "admin" ? adminMessage(payload as AdminPayload) : shopMessage(payload as ShopPayload);
    await sendWhatsapp(number, text);
    ok = true;
  } catch (e) {
    reason = e instanceof Error ? e.message : "Unknown error";
  }
  const { error: recErr } = await db.rpc("record_order_notification", {
    p_order_id: orderId,
    p_recipient: recipient,
    p_secret: secret,
    p_ok: ok,
    p_error: reason || undefined,
  });
  if (recErr) console.error("record_order_notification failed", recipient, recErr.code, recErr.message);
  if (!ok) console.error("WhatsApp alert failed", recipient, reason);
  return ok ? "sent" : "failed";
}

/**
 * Sends the admin and shop alerts for one order. Safe to call more than once:
 * a message that was already sent is skipped unless `force` is set (admin "Resend").
 */
export async function notifyOrder(
  db: Db,
  orderId: string,
  opts: { force?: boolean; recipients?: Recipient[] } = {},
): Promise<Record<Recipient, NotifyOutcome>> {
  const result: Record<Recipient, NotifyOutcome> = { admin: "unavailable", shop: "unavailable" };
  try {
    const secret = process.env.NOTIFY_SECRET;
    if (!secret || !wahaConfigured()) {
      console.warn("WhatsApp alerts are not configured (NOTIFY_SECRET / WAHA_*); skipping");
      return result;
    }
    const which = opts.recipients ?? (["admin", "shop"] as Recipient[]);
    const done = await Promise.all(which.map((r) => sendOne(db, orderId, r, secret, !!opts.force).catch(() => "unavailable" as const)));
    which.forEach((r, i) => (result[r] = done[i]));
  } catch (e) {
    console.error("notifyOrder failed", e instanceof Error ? e.message : e);
  }
  return result;
}
