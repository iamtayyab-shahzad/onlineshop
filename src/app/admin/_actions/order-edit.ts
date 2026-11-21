"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { after } from "next/server";
import { notifyOrder } from "@/lib/order-notify";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/orders";
import { adminDb } from "@/lib/auth";
import { isUuid, type ActionState } from "@/lib/admin-types";
import { cleanSearch } from "@/lib/order-search";
import { orderErrorMessage, parseEditorPayload, toRpcItems } from "@/lib/order-edit";

export type ProductHit = { id: string; name: string; unit_label: string; selling_price: number };

/** Product search for the "add item" box in the order editor (active products only). */
export async function searchProducts(q: string): Promise<ProductHit[]> {
  const { supabase } = await adminDb();
  const s = cleanSearch(typeof q === "string" ? q : "");
  if (s.length < 1) return [];
  const { data } = await supabase
    .from("products")
    .select("id, name, unit_label, selling_price")
    .eq("is_active", true)
    .or(`name.ilike.*${s}*,name_urdu.ilike.*${s}*`)
    .order("name")
    .limit(8);
  return data ?? [];
}

/**
 * Creates the order for a customer who sent a voice message (the database copies the customer's
 * name, phone and address), marks the voice message done, then sends the usual WhatsApp alerts.
 */
export async function createOrderFromVoice(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const voiceId = fd.get("voice_id");
  const method = fd.get("payment_method");
  if (!isUuid(voiceId) || !PAYMENT_METHODS.includes(method as PaymentMethod)) return { error: "Invalid request." };
  const parsed = parseEditorPayload(fd.get("payload"));
  if ("error" in parsed) return { error: parsed.error };
  const { items, discount, delivery_fee, note } = parsed.ok;
  if (items.some((i) => i.id)) return { error: "Invalid request." };

  const { data, error } = await supabase.rpc("admin_create_order", {
    p_voice_order_id: voiceId,
    p_items: toRpcItems(items),
    p_payment_method: method as PaymentMethod,
    p_discount: discount,
    p_delivery_fee: delivery_fee,
    p_note: note,
  });
  if (error) return { error: orderErrorMessage(error.message) };
  const made = data as { id?: string; already?: boolean } | null;
  if (!made?.id) return { error: "Could not save. Please try again." };
  if (!made.already) {
    const orderId = made.id;
    after(() => notifyOrder(supabase, orderId));
  }
  refresh();
  redirect(`/admin/orders/${made.id}`);
}

/** Saves the edited order: items, prices, quantities, discount and delivery fee. */
export async function updateOrder(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const id = fd.get("order_id");
  if (!isUuid(id)) return { error: "Invalid request." };
  const parsed = parseEditorPayload(fd.get("payload"));
  if ("error" in parsed) return { error: parsed.error };
  const { items, discount, delivery_fee, note } = parsed.ok;

  const { error } = await supabase.rpc("admin_update_order", {
    p_order_id: id,
    p_items: toRpcItems(items),
    p_discount: discount,
    p_delivery_fee: delivery_fee,
    p_note: note,
  });
  if (error) return { error: orderErrorMessage(error.message) };
  refresh();
  redirect(`/admin/orders/${id}`);
}
