import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  fullName: string;
  phone: string | null;
  isAdmin: boolean;
};

/**
 * The signed-in customer, or null. Reads the session cookie, so call it only
 * inside a <Suspense> boundary or a server action. Deduplicated per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, role")
    .eq("id", userId)
    .maybeSingle();

  return {
    id: userId,
    fullName: profile?.full_name ?? "",
    phone: profile?.phone ?? null,
    isAdmin: profile?.role === "admin",
  };
});

/** Like getCurrentUser, but sends signed-out visitors to the sign-in page and back afterwards. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/**
 * Customers sign in with phone + password. Supabase's password sign-in needs an
 * email-style id, so each phone maps to an internal one ("923001234567@…").
 * Customers never see it, and no email is ever sent to it.
 */
export function loginIdForPhone(phone03: string): string {
  // Supabase rejects reserved domains (.local, .test). The default is this project's own
  // Supabase host: it resolves in DNS and receives no mail. Set AUTH_PHONE_EMAIL_DOMAIN
  // before launch if you prefer your own domain. Never change it once customers exist,
  // or their existing logins stop matching.
  const domain =
    process.env.AUTH_PHONE_EMAIL_DOMAIN || new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
  return `92${phone03.slice(1)}@${domain}`;
}

/** Only allow returning to a page on this site (prevents redirects to other websites). */
export function safeNextPath(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.length > 200) return fallback;
  return value;
}

/**
 * Guard for every admin page and admin server action. The role is read from
 * the database on each request (never from the browser), and Row Level
 * Security checks it again inside Postgres.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (!user.isAdmin) redirect("/admin/login?denied=1");
  return user;
}

/** Supabase client for admin pages and actions: checks the admin role first, every time. */
export async function adminDb() {
  const user = await requireAdmin();
  const supabase = await createClient();
  return { user, supabase };
}
