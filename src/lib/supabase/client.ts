"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Browser Supabase client using the signed-in user's own session cookie.
 * Used only for direct file uploads (voice notes, payment screenshots, product
 * photos) so large files never pass through a server action. Storage RLS
 * decides what each user may upload.
 */
let client: ReturnType<typeof createBrowserClient<Database>> | null = null;
export function createBrowserSupabase() {
  client ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  return client;
}
