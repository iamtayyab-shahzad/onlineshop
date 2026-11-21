"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ActionState } from "@/lib/admin-types";
import { normalizeWhatsapp, sendWhatsapp, wahaConfigured } from "@/lib/waha";

/**
 * WhatsApp login code for the admin. These actions deliberately do NOT use adminDb():
 * they are what an admin who has typed the password but not the code is allowed to do.
 * The database decides everything that matters (it keeps the hashed code, counts wrong tries,
 * and only treats this login session as an admin once the right code was entered).
 */

const STORE_ERRORS: Record<string, string> = {
  not_admin: "This account is not an admin.",
  not_allowed: "The server is missing its alert secret. Check NOTIFY_SECRET in the deployment settings.",
  no_number: "No admin WhatsApp number is saved. Add it in Settings first.",
  too_many_codes: "Too many codes were sent. Please wait an hour and try again.",
  wait_a_moment: "A code was just sent. Wait a few seconds, then ask for a new one.",
};

/** Makes a new 6-digit code, stores it (hashed) in the database and sends it to the admin's WhatsApp. */
export async function sendLoginCode(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { error: "Please sign in again." };
  const secret = process.env.NOTIFY_SECRET;
  if (!secret || !wahaConfigured()) return { error: "WhatsApp is not set up on the server, so no code can be sent." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_store_login_code", { p_secret: secret, p_code: code });
  if (error) {
    const key = Object.keys(STORE_ERRORS).find((k) => error.message.includes(k));
    return { error: key ? STORE_ERRORS[key] : "Could not create a code. Please try again." };
  }
  const to = normalizeWhatsapp(typeof data === "object" && data && "to" in data ? String(data.to) : null);
  if (!to) return { error: "The admin WhatsApp number saved in Settings is not valid." };

  const text = `Your shop admin login code is ${code}. It works for 10 minutes. If you did not just sign in, ignore this message and do not share the code.`;
  // The free WhatsApp server can be asleep for a minute: try twice before giving up.
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await sendWhatsapp(to, text);
      return { ok: "Code sent to your WhatsApp." };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "unknown error";
    }
  }
  console.error("admin login code could not be sent:", lastError);
  return { error: "The WhatsApp message could not be sent. Wait a moment and press “Send a new code”." };
}

/** Checks the typed code. On success this login session becomes a full admin session. */
export async function verifyLoginCode(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { error: "Please sign in again." };
  const code = String(fd.get("code") ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6 numbers from the WhatsApp message." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_verify_login_code", { p_code: code });
  if (error) return { error: "Could not check the code. Please try again." };
  switch (data) {
    case "ok":
      redirect("/admin/dashboard");
    case "wrong":
      return { error: "That code is not right. Check the message and try again." };
    case "expired":
      return { error: "This code has expired. Press “Send a new code”." };
    case "locked":
      return { error: "Too many wrong tries. Press “Send a new code”." };
    default:
      return { error: "No code was sent yet. Press “Send a new code”." };
  }
}
