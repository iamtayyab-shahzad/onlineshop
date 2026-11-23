"use server";

import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { notifyVoiceOrder } from "@/lib/voice-notify";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Saves a voice order after the browser uploaded the recording to the customer's own private folder. */
export async function createVoiceOrder(input: {
  audioPath: string;
  durationSeconds: number;
  addressId: string | null;
  note: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (!new RegExp(`^${user.id}/[0-9a-f-]{36}\\.(webm|ogg|m4a|mp4|aac)$`).test(String(input.audioPath))) {
    return { ok: false, error: "Recording upload failed. Please try again." };
  }
  const supabase = await createClient();
  let addressId: string | null = null;
  if (input.addressId) {
    if (!UUID.test(input.addressId)) return { ok: false, error: "Please choose an address." };
    // Only the customer's own address (RLS also limits what they can read).
    const { data } = await supabase.from("addresses").select("id").eq("id", input.addressId).eq("user_id", user.id).maybeSingle();
    if (!data) return { ok: false, error: "Please choose an address." };
    addressId = data.id;
  }
  const duration = Math.max(0, Math.min(600, Math.round(Number(input.durationSeconds) || 0)));
  const { data: saved, error } = await supabase
    .from("voice_orders")
    .insert({
    user_id: user.id,
    audio_path: input.audioPath,
    duration_seconds: duration,
    address_id: addressId,
    customer_note: String(input.note ?? "").trim().slice(0, 500) || null,
    })
    .select("id")
    .single();
  if (error || !saved) return { ok: false, error: "Could not send. Please try again or call us." };
  // Tell the admin on WhatsApp after the customer already has their confirmation. Never affects the order.
  after(() => notifyVoiceOrder(supabase, saved.id));
  return { ok: true };
}
