"use server";

import { getCurrentUser } from "@/lib/auth";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

export type PlaceOrderResult = { ok: true; id: string } | { ok: false; error: string; code?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ERRORS: Record<string, string> = {
  not_signed_in: "Please sign in again to place your order.",
  empty_cart: "Your cart is empty.",
  too_many_items: "Too many different items in one order. Please split it into two orders.",
  note_too_long: "Your note is too long. Please keep it under 500 letters.",
  address_not_found: "Please choose a delivery address.",
  invalid_quantity: "One of the quantities is not allowed. Please check your cart.",
  item_unavailable: "Some items are no longer available. Please go back to your cart to see the update.",
  below_minimum: "Your order is below the minimum amount. Please add more items.",
  invalid_amount: "One of the amounts is not allowed. Please check your cart.",
  duplicate_item: "An item is in your cart twice. Please check your cart.",
  payment_method_unavailable: "This payment method is not available right now. Please choose another one.",
};

/**
 * Places the order. The browser only sends product ids and quantities (or a rupee amount); the
 * database function `place_order` looks up today's prices, checks stock status
 * and the minimum, and saves price snapshots. Nothing the browser says about
 * prices is trusted.
 */
export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: ERRORS.not_signed_in, code: "not_signed_in" };

  if (!input || typeof input !== "object") return { ok: false, error: "Something went wrong. Please try again." };
  const { items, addressId, paymentMethod, note, requestId } = input as Record<string, unknown>;

  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: ERRORS.empty_cart };
  if (items.length > 100) return { ok: false, error: ERRORS.too_many_items };
  // Shape checks only. The database checks each product's own min / max / step
  // and recalculates every price and total with exact numeric arithmetic.
  const cleanItems: ({ product_id: string; quantity: number } | { product_id: string; amount: number })[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const { id, qty, amount } = (it ?? {}) as { id?: unknown; qty?: unknown; amount?: unknown };
    if (typeof id !== "string" || !UUID.test(id) || seen.has(id)) return { ok: false, error: ERRORS.invalid_quantity };
    seen.add(id);
    if (amount !== undefined) {
      if (!Number.isInteger(amount) || (amount as number) < 1 || (amount as number) > 1_000_000) {
        return { ok: false, error: ERRORS.invalid_amount };
      }
      cleanItems.push({ product_id: id, amount: amount as number });
    } else {
      const q = typeof qty === "number" ? Math.round(qty * 1000) / 1000 : NaN;
      if (!Number.isFinite(q) || q <= 0 || q > 10_000) return { ok: false, error: ERRORS.invalid_quantity };
      cleanItems.push({ product_id: id, quantity: q });
    }
  }
  if (typeof addressId !== "string" || !UUID.test(addressId)) return { ok: false, error: ERRORS.address_not_found };
  if (typeof paymentMethod !== "string" || !PAYMENT_METHODS.includes(paymentMethod as PaymentMethod)) {
    return { ok: false, error: "Please choose how you will pay." };
  }
  const cleanNote = typeof note === "string" ? note.trim() : "";
  if (cleanNote.length > 500) return { ok: false, error: ERRORS.note_too_long };
  if (typeof requestId !== "string" || !UUID.test(requestId)) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_items: cleanItems,
    p_address_id: addressId,
    p_payment_method: paymentMethod as PaymentMethod,
    p_note: cleanNote || undefined,
    p_request_id: requestId,
  });

  if (error) {
    const code = Object.keys(ERRORS).find((c) => error.message.includes(c));
    if (!code) console.error("place_order failed", error.code, error.message);
    return { ok: false, error: code ? ERRORS[code] : "We could not place your order. Please try again.", code };
  }
  const id = (data as { id?: unknown } | null)?.id;
  if (typeof id !== "string") return { ok: false, error: "We could not place your order. Please try again." };
  return { ok: true, id };
}
