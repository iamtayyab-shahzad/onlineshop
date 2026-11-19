"use server";

import { refresh, updateTag } from "next/cache";
import { adminDb } from "@/lib/auth";
import { num, text, type ActionState } from "@/lib/admin-types";

const QR_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/store/`;
/** Only our own uploaded QR images are accepted (no outside links). */
const qr = (fd: FormData, name: string) => {
  const v = text(fd, name, 400);
  return v && v.startsWith(QR_PREFIX) && !v.includes("..") ? v : null;
};

export async function saveStoreSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const fee = num(fd, "delivery_fee");
  const min = num(fd, "min_order_amount");
  if (fee == null || fee < 0 || min == null || min < 0) return { error: "Delivery fee and minimum order must be numbers." };
  const { error } = await supabase
    .from("store_settings")
    .update({
      store_name: text(fd, "store_name", 80) ?? "Grocery",
      support_phone: text(fd, "support_phone", 20),
      support_whatsapp: text(fd, "support_whatsapp", 20),
      delivery_fee: fee,
      min_order_amount: min,
      delivery_hours: text(fd, "delivery_hours", 200),
      delivery_areas: text(fd, "delivery_areas", 500),
    })
    .eq("id", true);
  if (error) return { error: "Could not save." };
  updateTag("catalog");
  refresh();
  return { ok: "Saved." };
}

/** Accounts customers pay into. Leave a method empty to hide it at checkout. */
export async function savePaymentAccounts(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const { error } = await supabase
    .from("store_settings")
    .update({
      jazzcash_number: text(fd, "jazzcash_number", 20),
      jazzcash_account_name: text(fd, "jazzcash_account_name", 80),
      jazzcash_qr_url: qr(fd, "jazzcash_qr_url"),
      easypaisa_number: text(fd, "easypaisa_number", 20),
      easypaisa_account_name: text(fd, "easypaisa_account_name", 80),
      easypaisa_qr_url: qr(fd, "easypaisa_qr_url"),
      bank_name: text(fd, "bank_name", 80),
      bank_account_title: text(fd, "bank_account_title", 80),
      bank_account_number: text(fd, "bank_account_number", 40),
      bank_iban: text(fd, "bank_iban", 40),
      bank_qr_url: qr(fd, "bank_qr_url"),
    })
    .eq("id", true);
  if (error) return { error: "Could not save." };
  updateTag("catalog");
  refresh();
  return { ok: "Payment accounts saved." };
}

export async function saveShop(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const name = text(fd, "name", 80);
  if (!name) return { error: "Enter the shop name." };
  const row = { name, whatsapp_phone: text(fd, "whatsapp_phone", 20), address: text(fd, "address", 200), is_default: true };
  const id = text(fd, "id", 40);
  const { error } = id
    ? await supabase.from("shops").update(row).eq("id", id)
    : await supabase.from("shops").insert(row);
  if (error) return { error: "Could not save." };
  refresh();
  return { ok: "Saved." };
}
