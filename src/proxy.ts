import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Keeps the customer's sign-in fresh: if the access token has expired, Supabase
 * refreshes it here and the new cookie is sent back with the response.
 * This is NOT the security check. Every page and server action that touches
 * customer data checks the session again, and Row Level Security checks it in
 * the database.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          // Never let a CDN cache a response that carries someone's session cookie.
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Validates the token and refreshes it when needed. Do not remove.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Everything except static files, images, icons, the service worker and the manifest.
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|offline.html|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
