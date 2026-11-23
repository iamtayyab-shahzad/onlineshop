"use server";

import { refresh } from "next/cache";
import { adminDb } from "@/lib/auth";
import { bool, isUuid, text, type ActionState } from "@/lib/admin-types";
import { notifyOrder, type NotifyOutcome, type Recipient } from "@/lib/order-notify";
import { notifyVoiceOrder } from "@/lib/voice-notify";
import { normalizeWhatsapp } from "@/lib/waha";

/** Admin number + on/off switch for automatic order alerts. (The shop's number is in Settings → Supplier shop.) */
export async function saveNotificationSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const raw = text(fd, "admin_whatsapp", 20);
  const admin = raw ? normalizeWhatsapp(raw) : null;
  if (raw && !admin) return { error: "Enter a valid mobile number, like 03001234567." };
  const { error } = await supabase
    .from("notification_settings")
    .update({ admin_whatsapp: admin, alerts_enabled: bool(fd, "alerts_enabled") })
    .eq("id", true);
  if (error) return { error: "Could not save." };
  refresh();
  return { ok: "Saved." };
}

/** Turns the WhatsApp login code on or off. The database refuses to turn it on until the number and server secret exist. */
export async function setLoginCodeCheck(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const on = fd.get("on") === "true";
  const { error } = await supabase.rpc("admin_set_login_check", { p_on: on });
  if (error) {
    if (error.message.includes("need_number")) return { error: "Save your admin WhatsApp number above first." };
    if (error.message.includes("need_secret")) {
      return { error: "The WhatsApp alert secret is not set up yet, so codes cannot be sent. Order alerts must work first." };
    }
    return { error: "Could not change this. Please sign in again and retry." };
  }
  refresh();
  return { ok: on ? "Login code is ON. Next time you sign in, a code comes on WhatsApp." : "Login code is OFF." };
}

const word = (o: NotifyOutcome) =>
  o === "sent" ? "sent" : o === "failed" ? "failed again" : o === "skipped" ? "already being sent" : "could not start";

/** Sends one order's WhatsApp alert again (admin only). */
export async function resendNotification(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const orderId = fd.get("order_id");
  const recipient = fd.get("recipient");
  if (!isUuid(orderId) || (recipient !== "admin" && recipient !== "shop")) return { error: "Invalid request." };
  const out = await notifyOrder(supabase, orderId, { force: true, recipients: [recipient as Recipient] });
  refresh();
  const r = out[recipient as Recipient];
  return r === "sent" ? { ok: "Sent." } : { error: `Message ${word(r)}. See the reason above.` };
}

/** Sends one voice order’s WhatsApp alert again (admin only). */
export async function resendVoiceAlert(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const voiceId = fd.get("voice_id");
  if (!isUuid(voiceId)) return { error: "Invalid request." };
  const out = await notifyVoiceOrder(supabase, voiceId, { force: true });
  refresh();
  return out === "sent" ? { ok: "Sent." } : { error: `Message ${word(out)}. See the reason shown on the card.` };
}

/** Tries every failed or stuck alert again (newest 20). */
export async function retryFailedNotifications(): Promise<ActionState> {
  const { supabase } = await adminDb();
  const { data } = await supabase
    .from("order_notifications")
    .select("order_id, recipient")
    .in("status", ["failed", "pending", "sending"]) // "sending" is only taken again once it is over 2 minutes old
    .order("created_at", { ascending: false })
    .limit(20);
  // Voice orders that never got their alert (new ones only).
  const { data: voice } = await supabase
    .from("voice_orders")
    .select("id")
    .eq("status", "new")
    .is("alerted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  const total = (data?.length ?? 0) + (voice?.length ?? 0);
  if (total === 0) return { ok: "Nothing to retry." };
  let sent = 0;
  for (const n of data ?? []) {
    const out = await notifyOrder(supabase, n.order_id, { recipients: [n.recipient as Recipient] });
    if (out[n.recipient as Recipient] === "sent") sent++;
  }
  for (const v of voice ?? []) {
    if ((await notifyVoiceOrder(supabase, v.id)) === "sent") sent++;
  }
  refresh();
  return sent === total ? { ok: `Sent ${sent}.` } : { error: `Sent ${sent} of ${total}. The rest failed again.` };
}
