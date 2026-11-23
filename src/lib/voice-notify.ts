import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { formatDate } from "@/lib/orders";
import { normalizeWhatsapp, sendWhatsapp, sendWhatsappAudio, wahaConfigured } from "@/lib/waha";
import type { NotifyOutcome } from "@/lib/order-notify";

/**
 * WhatsApp alert to the admin when a customer sends a voice order.
 * Same rules as order alerts: the message comes from a secret-protected database function,
 * every failure is caught and saved on the voice order (so it can be sent again), and nothing
 * here can stop a voice order from being saved.
 */

type Payload = {
  placed_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  area: string | null;
  address: string | null;
  landmark: string | null;
  note: string | null;
  seconds: number | null;
  audio_path: string | null;
};

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MIME: Record<string, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg; codecs=opus",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
};

/** Forwards the recording itself, best effort: the text alert is already sent, so a failure here is only logged. */
async function forwardAudio(db: SupabaseClient<Database>, number: string, path: string | null) {
  if (!path) return;
  try {
    const { data: blob, error } = await db.storage.from("voice-orders").download(path);
    if (error || !blob) throw new Error("recording not found");
    if (blob.size > MAX_AUDIO_BYTES) throw new Error("recording too large");
    const ext = (path.split(".").pop() ?? "webm").toLowerCase();
    await sendWhatsappAudio(number, {
      data: Buffer.from(await blob.arrayBuffer()).toString("base64"),
      mimetype: MIME[ext] ?? "audio/webm",
      filename: `voice-order.${ext}`,
    });
  } catch (e) {
    console.error("Could not forward the voice recording", e instanceof Error ? e.message : e);
  }
}

function message(p: Payload): string {
  const where = [p.address, p.area].filter(Boolean).join(", ");
  return [
    "🎤 New voice order",
    `${formatDate(p.placed_at)}${p.seconds ? ` · ${p.seconds}s` : ""}`,
    "",
    `👤 ${p.customer_name || "Customer"}`,
    p.customer_phone ? `📞 ${p.customer_phone}` : null,
    where ? `📍 ${where}${p.landmark ? ` (near ${p.landmark})` : ""}` : null,
    p.note ? `📝 Note: ${p.note}` : null,
    "",
    "🎧 The recording follows in the next message. If it does not arrive or will not play, listen to it in the admin panel → Voice orders.",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

export async function notifyVoiceOrder(
  db: SupabaseClient<Database>,
  voiceId: string,
  opts: { force?: boolean } = {},
): Promise<NotifyOutcome> {
  try {
    const secret = process.env.NOTIFY_SECRET;
    if (!secret || !wahaConfigured()) {
      console.warn("WhatsApp alerts are not configured (NOTIFY_SECRET / WAHA_*); skipping voice alert");
      return "unavailable";
    }
    const { data, error } = await db.rpc("claim_voice_alert", {
      p_voice_id: voiceId,
      p_secret: secret,
      p_force: !!opts.force,
    });
    if (error) {
      console.error("claim_voice_alert failed", error.code, error.message);
      return "unavailable";
    }
    if (!data) return "skipped"; // alerts off, already sent, or being sent

    const { to, payload } = data as unknown as { to: string | null; payload: Payload };
    let ok = false;
    let reason = "";
    try {
      const number = normalizeWhatsapp(to) ?? normalizeWhatsapp(process.env.ORDER_ADMIN_WHATSAPP);
      if (!number) throw new Error("No admin WhatsApp number is set");
      await sendWhatsapp(number, message(payload));
      ok = true;
      await forwardAudio(db, number, payload.audio_path);
    } catch (e) {
      reason = e instanceof Error ? e.message : "Unknown error";
    }
    const { error: recErr } = await db.rpc("record_voice_alert", {
      p_voice_id: voiceId,
      p_secret: secret,
      p_ok: ok,
      p_error: reason || undefined,
    });
    if (recErr) console.error("record_voice_alert failed", recErr.code, recErr.message);
    if (!ok) console.error("WhatsApp voice alert failed", reason);
    return ok ? "sent" : "failed";
  } catch (e) {
    console.error("notifyVoiceOrder failed", e instanceof Error ? e.message : e);
    return "unavailable";
  }
}
