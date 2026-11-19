"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizePkMobile } from "@/lib/phone";

export type FormState = { error?: string; ok?: string } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string, max: number): string {
  return String(formData.get(key) ?? "").trim().replace(/\s+/g, " ").slice(0, max + 1);
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/profile");

  const fullName = text(formData, "fullName", 80);
  if (fullName.length < 2 || fullName.length > 80) return { error: "Please enter your name." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
  if (error) return { error: "Could not save. Please try again." };
  return { ok: "Saved." };
}

export async function saveAddress(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/addresses");

  const id = String(formData.get("id") ?? "");
  const next = safeNextPath(formData.get("next"), "/account/addresses");
  const label = text(formData, "label", 30) || "Home";
  const recipient = text(formData, "recipient_name", 80);
  const phone = normalizePkMobile(String(formData.get("phone") ?? ""));
  const area = text(formData, "area", 80);
  const line = text(formData, "address_line", 300);
  const landmark = text(formData, "landmark", 150);
  const makeDefault = formData.get("is_default") === "on";

  if (label.length > 30) return { error: "Label is too long." };
  if (recipient.length < 2 || recipient.length > 80) return { error: "Please enter the name of the person receiving the order." };
  if (!phone) return { error: "Please enter a valid mobile number, like 0300 1234567." };
  if (area.length < 2 || area.length > 80) return { error: "Please enter your area or sector." };
  if (line.length < 5 || line.length > 300) return { error: "Please enter your full address (house, street, block)." };
  if (landmark.length > 150) return { error: "Landmark is too long." };

  const supabase = await createClient();
  const values = {
    label,
    recipient_name: recipient,
    phone,
    area,
    address_line: line,
    landmark: landmark || null,
  };

  let addressId = id;
  if (id) {
    if (!UUID.test(id)) return { error: "Address not found." };
    const { data, error } = await supabase
      .from("addresses")
      .update(values)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error || !data) return { error: "Could not save the address. Please try again." };
  } else {
    const { count } = await supabase
      .from("addresses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= 10) return { error: "You can save up to 10 addresses. Please delete one first." };
    const { data, error } = await supabase
      .from("addresses")
      .insert({ ...values, user_id: user.id, is_default: false })
      .select("id")
      .single();
    if (error || !data) return { error: "Could not save the address. Please try again." };
    addressId = data.id;
    // The first address is always the default.
    if (count === 0) await supabase.rpc("set_default_address", { p_address_id: addressId });
  }

  if (makeDefault) await supabase.rpc("set_default_address", { p_address_id: addressId });

  redirect(next.includes("?") ? `${next}&address=${addressId}` : `${next}?address=${addressId}`);
}

export async function deleteAddress(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/addresses");
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) redirect("/account/addresses");

  const supabase = await createClient();
  const { data: removed } = await supabase
    .from("addresses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("is_default")
    .maybeSingle();

  // Keep one default address if any remain. (Past orders keep their own copy of the address.)
  if (removed?.is_default) {
    const { data: newest } = await supabase
      .from("addresses")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (newest) await supabase.rpc("set_default_address", { p_address_id: newest.id });
  }
  redirect("/account/addresses");
}

export async function makeDefaultAddress(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/addresses");
  const id = String(formData.get("id") ?? "");
  if (UUID.test(id)) {
    const supabase = await createClient();
    await supabase.rpc("set_default_address", { p_address_id: id });
  }
  redirect("/account/addresses");
}
