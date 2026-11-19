import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Per-request Supabase client that acts AS the signed-in customer (their
 * session cookie), so Row Level Security limits every query to their own rows.
 * Create a new one for each request; never use it inside 'use cache'.
 */
export async function createClient() {
  // Session checks compare token expiry with the clock, so mark this render as request-time.
  await connection();
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, which cannot set cookies.
            // The proxy refreshes the session cookie on every request instead.
          }
        },
      },
    },
  );
}
