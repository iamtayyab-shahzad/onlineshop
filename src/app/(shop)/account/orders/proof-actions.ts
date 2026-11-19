"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Customer says "I have paid": a transaction ID and/or a screenshot path they
 * uploaded to their own private folder. The shop still checks its account
 * before marking the order paid. RLS makes sure it is the customer's own order.
 */
export async function submitPaymentProof(input: {
  orderId: string;
  transactionRef: string;
  screenshotPath: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const ref = String(input.transactionRef ?? "").trim().slice(0, 60);
  const path = input.screenshotPath;
  if (!UUID.test(input.orderId)) return { ok: false, error: "Order not found." };
  if (path !== null && !new RegExp(`^${user.id}/[0-9a-f-]{36}\\.(webp|jpg|png)$`).test(path)) {
    return { ok: false, error: "Screenshot upload failed. Please try again." };
  }
  if (!ref && !path) return { ok: false, error: "Please write the transaction ID or add a screenshot." };

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, payment_method, total, payment_status")
    .eq("id", input.orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order || order.payment_method === "cod") return { ok: false, error: "Order not found." };
  if (order.payment_status === "paid") return { ok: false, error: "This order is already marked as paid." };

  const { error } = await supabase.from("payment_proofs").insert({
    order_id: order.id,
    submitted_by: user.id,
    method: order.payment_method,
    amount: order.total,
    transaction_ref: ref || null,
    screenshot_path: path,
  });
  if (error) return { ok: false, error: "Could not send. Please try again or call us." };
  refresh();
  return { ok: true };
}
