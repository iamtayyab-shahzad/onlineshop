"use server";

import { refresh } from "next/cache";
import { adminDb } from "@/lib/auth";
import { isUuid, text, type ActionState } from "@/lib/admin-types";
import { cleanSearch, orderSearchFilter } from "@/lib/order-search";
import { ADMIN_STATUSES, type OrderStatus, type PaymentStatus } from "@/lib/orders";

const STATUSES = ADMIN_STATUSES;
const PAY: PaymentStatus[] = ["unpaid", "pending_verification", "paid", "refunded"];

export async function setOrderStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const id = fd.get("order_id");
  const status = fd.get("status") as OrderStatus;
  if (!isUuid(id) || !STATUSES.includes(status)) return { error: "Invalid request." };
  const { error } = await supabase.rpc("admin_set_order_status", {
    p_order_id: id,
    p_status: status,
    p_note: text(fd, "note", 300) ?? undefined,
  });
  if (error) return { error: "Could not change the status. Please try again." };
  refresh();
  return { ok: "Status updated." };
}

export type OrderSuggestion = {
  id: string;
  order_number: number;
  delivery_name: string;
  delivery_phone: string;
  total: number;
  status: OrderStatus;
  created_at: string;
};

/** Live suggestions under the orders search box: the latest orders matching the name, phone or order number. */
export async function orderSuggestions(q: string): Promise<OrderSuggestion[]> {
  const { supabase } = await adminDb();
  if (typeof q !== "string" || cleanSearch(q).length < 2) return [];
  const filter = orderSearchFilter(q);
  if (!filter) return [];
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, delivery_name, delivery_phone, total, status, created_at")
    .or(filter)
    .order("created_at", { ascending: false })
    .limit(8);
  return data ?? [];
}

export async function setPaymentStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const id = fd.get("order_id");
  const status = fd.get("payment_status") as PaymentStatus;
  if (!isUuid(id) || !PAY.includes(status)) return { error: "Invalid request." };
  const { error } = await supabase.from("orders").update({ payment_status: status }).eq("id", id);
  if (error) return { error: "Could not update the payment." };
  refresh();
  return { ok: "Payment updated." };
}

/** Verify or reject a payment proof. Only an admin who checked the account statement should verify. */
export async function reviewProof(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await adminDb();
  const id = fd.get("proof_id");
  const decision = fd.get("decision");
  if (!isUuid(id) || (decision !== "verified" && decision !== "rejected")) return { error: "Invalid request." };
  const { data: proof, error } = await supabase
    .from("payment_proofs")
    .update({
      status: decision,
      admin_note: text(fd, "admin_note", 300),
      verified_by: user.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("order_id")
    .single();
  if (error || !proof) return { error: "Could not save. Please try again." };
  await supabase
    .from("orders")
    .update({ payment_status: decision === "verified" ? "paid" : "unpaid" })
    .eq("id", proof.order_id);
  refresh();
  return { ok: decision === "verified" ? "Marked as paid." : "Payment rejected." };
}

export async function updateVoiceOrder(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const id = fd.get("voice_id");
  const status = fd.get("status");
  if (!isUuid(id) || (status !== "new" && status !== "converted" && status !== "rejected")) {
    return { error: "Invalid request." };
  }
  const orderNo = Number(fd.get("order_number") || 0);
  let orderId: string | null = null;
  if (orderNo) {
    const { data } = await supabase.from("orders").select("id").eq("order_number", orderNo).maybeSingle();
    if (!data) return { error: `Order #${orderNo} was not found.` };
    orderId = data.id;
  }
  const { error } = await supabase
    .from("voice_orders")
    .update({ status, admin_note: text(fd, "admin_note", 500), ...(orderId ? { order_id: orderId } : {}) })
    .eq("id", id);
  if (error) return { error: "Could not save." };
  refresh();
  return { ok: "Saved." };
}
