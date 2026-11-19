"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { loginIdForPhone, safeNextPath } from "@/lib/auth";
import { normalizePkMobile } from "@/lib/phone";

export type AuthFormState = {
  error?: string;
  values?: { phone?: string; fullName?: string };
} | null;

const PHONE_ERROR = "Please enter a valid mobile number, like 0300 1234567.";

function friendlyAuthError(error: AuthError, mode: "signin" | "signup"): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Wrong phone number or password. Please try again.";
    case "user_already_exists":
    case "email_exists":
      return "This number already has an account. Please sign in instead.";
    case "weak_password":
      return "Please choose a longer password (at least 6 letters or numbers).";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many tries. Please wait a few minutes and try again.";
    case "email_not_confirmed":
      return "Your account is not active yet. Please call us and we will fix it.";
    default:
      console.error(`[auth] ${mode} failed`, error.code, error.message);
      return "Something went wrong. Please try again, or call us for help.";
  }
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const phoneInput = String(formData.get("phone") ?? "").slice(0, 30);
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));
  const values = { phone: phoneInput };

  const phone = normalizePkMobile(phoneInput);
  if (!phone) return { error: PHONE_ERROR, values };
  if (!password || password.length > 72) return { error: "Please enter your password.", values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: loginIdForPhone(phone), password });
  if (error) return { error: friendlyAuthError(error, "signin"), values };

  redirect(next);
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim().replace(/\s+/g, " ");
  const phoneInput = String(formData.get("phone") ?? "").slice(0, 30);
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));
  const values = { phone: phoneInput, fullName: fullName.slice(0, 80) };

  if (fullName.length < 2 || fullName.length > 80) return { error: "Please enter your name.", values };
  const phone = normalizePkMobile(phoneInput);
  if (!phone) return { error: PHONE_ERROR, values };
  if (password.length < 6) return { error: "Password must be at least 6 letters or numbers.", values };
  if (password.length > 72) return { error: "Password is too long (72 characters at most).", values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: loginIdForPhone(phone),
    password,
    options: { data: { full_name: fullName, phone } },
  });
  if (error) return { error: friendlyAuthError(error, "signup"), values };

  if (!data.session) {
    // Supabase did not sign the user in. Either the number is already registered
    // (Supabase hides that on purpose) or "Confirm email" is still switched on in
    // the Supabase dashboard (Authentication → Sign In / Providers → Email).
    console.error("[auth] sign-up returned no session: existing number, or 'Confirm email' is still on");
    return {
      error: "We could not create your account. If you have signed up before, please sign in instead.",
      values,
    };
  }

  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
