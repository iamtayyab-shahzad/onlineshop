import "server-only";

/**
 * Sends WhatsApp text through our WAHA server. Server-side only: the API key never
 * reaches the browser and is never logged.
 */

/** 0300 1234567 / +92 300 1234567 / 923001234567 → "923001234567". Returns null if it does not look like a mobile number. */
export function normalizeWhatsapp(raw: string | null | undefined): string | null {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = `92${d.slice(1)}`;
  else if (d.length === 10 && d.startsWith("3")) d = `92${d}`;
  return /^92\d{10}$/.test(d) ? d : null;
}

export const wahaConfigured = () => !!(process.env.WAHA_BASE_URL && process.env.WAHA_API_KEY);

/** Throws an Error with a short, safe message when sending fails. */
export async function sendWhatsapp(toDigits: string, text: string): Promise<void> {
  const base = process.env.WAHA_BASE_URL?.replace(/\/+$/, "");
  const key = process.env.WAHA_API_KEY;
  if (!base || !key) throw new Error("WAHA is not configured");

  let res: Response;
  try {
    res = await fetch(`${base}/api/sendText`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify({
        session: process.env.WAHA_SESSION || "default",
        chatId: `${toDigits}@c.us`,
        text,
      }),
      // A sleeping free-tier server can take a while to wake up. Fail clearly instead of hanging.
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new Error(timedOut ? "WhatsApp server did not answer in time" : "Could not reach the WhatsApp server");
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 120).replace(/\s+/g, " ");
    } catch {
      /* ignore */
    }
    throw new Error(`WhatsApp server replied ${res.status}${detail ? `: ${detail}` : ""}`);
  }
}

type AudioFile = { data: string; mimetype: string; filename: string };

async function post(path: string, body: Record<string, unknown>): Promise<void> {
  const base = process.env.WAHA_BASE_URL?.replace(/\/+$/, "");
  const key = process.env.WAHA_API_KEY;
  if (!base || !key) throw new Error("WAHA is not configured");
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify({ session: process.env.WAHA_SESSION || "default", ...body }),
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
  } catch {
    throw new Error("Could not reach the WhatsApp server");
  }
  if (!res.ok) throw new Error(`WhatsApp server replied ${res.status}`);
}

/**
 * Forwards a recording. Tries to send it as a playable voice note first; if the WAHA server cannot do
 * that (it needs a paid add-on to convert formats), sends it as an audio file instead.
 */
export async function sendWhatsappAudio(toDigits: string, file: AudioFile): Promise<"voice" | "file"> {
  const chatId = `${toDigits}@c.us`;
  try {
    await post("/api/sendVoice", { chatId, file, convert: true });
    return "voice";
  } catch {
    await post("/api/sendFile", { chatId, file });
    return "file";
  }
}
