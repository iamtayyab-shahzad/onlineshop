"use server";

import { refresh } from "next/cache";
import { adminDb } from "@/lib/auth";
import { bool, isUuid, text, type ActionState } from "@/lib/admin-types";
import { notifyOrder, type NotifyOutcome, type Recipient } from "@/lib/order-notify";
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

/** Tries every failed or stuck alert again (newest 20). */
export async function retryFailedNotifications(): Promise<ActionState> {
  const { supabase } = await adminDb();
  const { data } = await supabase
    .from("order_notifications")
    .select("order_id, recipient")
    .in("status", ["failed", "pending"])
    .order("created_at", { ascending: false })
    .limit(20);
  if (!data || data.length === 0) return { ok: "Nothing to retry." };
  let sent = 0;
  for (const n of data) {
    const out = await notifyOrder(supabase, n.order_id, { recipients: [n.recipient as Recipient] });
    if (out[n.recipient as Recipient] === "sent") sent++;
  }
  refresh();
  return sent === data.length ? { ok: `Sent ${sent}.` } : { error: `Sent ${sent} of ${data.length}. The rest failed again.` };
}
