"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProductsByIds } from "@/lib/catalog";
import { ruleFor } from "@/lib/catalog-item";
import { isValidAmount, snapQty } from "@/lib/quantity";

export type MonthlyResult = { ok: boolean; error?: string; needLogin?: boolean; saved?: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Input = { id: string; qty: number; amount?: number | null };

/**
 * Saves items to the customer's own Monthly List (adds new ones, updates existing ones).
 * Quantities are checked against each product's buying rules, like the cart.
 * Row Level Security also limits every row to the signed-in customer.
 */
export async function saveToMonthlyList(items: unknown): Promise<MonthlyResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, needLogin: true, error: "Please sign in to save your list." };
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: "Nothing to save." };

  const wanted = (items.slice(0, 100) as Input[]).filter(
    (i) => i && typeof i.id === "string" && UUID.test(i.id) && Number.isFinite(Number(i.qty)),
  );
  const products = await getProductsByIds(wanted.map((w) => w.id));
  const rows: { user_id: string; product_id: string; quantity: number; amount: number | null }[] = [];

  for (const w of wanted) {
    const p = products.find((x) => x.id === w.id);
    if (!p) continue;
    const rule = ruleFor(p);
    const amount = w.amount ? Number(w.amount) : null;
    if (amount) {
      if (!isValidAmount(amount, rule)) continue;
      rows.push({ user_id: user.id, product_id: p.id, quantity: Math.max(0.001, Number(w.qty) || 1), amount });
    } else {
      const qty = snapQty(Number(w.qty), rule);
      if (qty) rows.push({ user_id: user.id, product_id: p.id, quantity: qty, amount: null });
    }
  }
  if (rows.length === 0) return { ok: false, error: "These items cannot be saved right now." };

  const supabase = await createClient();
  const { error } = await supabase.from("monthly_list_items").upsert(rows, { onConflict: "user_id,product_id" });
  if (error) return { ok: false, error: "Could not save. Please try again." };
  refresh();
  return { ok: true, saved: rows.length };
}

/** Changes the quantity of one saved item. */
export async function setMonthlyQty(productId: string, qty: number): Promise<MonthlyResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, needLogin: true };
  if (!UUID.test(String(productId))) return { ok: false, error: "Item not found." };
  const [p] = await getProductsByIds([productId]);
  if (!p) return { ok: false, error: "This item is no longer sold." };
  const next = snapQty(Number(qty), ruleFor(p));
  if (!next) return { ok: false, error: "Please choose a valid quantity." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("monthly_list_items")
    .update({ quantity: next, amount: null })
    .eq("user_id", user.id)
    .eq("product_id", productId);
  if (error) return { ok: false, error: "Could not change. Please try again." };
  refresh();
  return { ok: true };
}

/** Removes one item from the list. */
export async function removeFromMonthlyList(productId: string): Promise<MonthlyResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, needLogin: true };
  if (!UUID.test(String(productId))) return { ok: false, error: "Item not found." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("monthly_list_items")
    .delete()
    .eq("user_id", user.id)
    .eq("product_id", productId);
  if (error) return { ok: false, error: "Could not remove. Please try again." };
  refresh();
  return { ok: true };
}
