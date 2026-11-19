import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, CircleHelp, ClipboardList, LogOut, MapPin, Package, UserRound } from "lucide-react";
import { BlockSkeleton } from "@/components/skeletons";
import { getCurrentUser } from "@/lib/auth";
import { formatPkMobile } from "@/lib/phone";
import { signOut } from "@/app/auth-actions";

export const metadata: Metadata = { title: "My account" };

// Exactly five sections, as agreed. My Monthly List arrives in Stage 5.
const SECTIONS = [
  { label: "Profile", hint: "Your name and phone number", icon: UserRound, href: "/account/profile" },
  { label: "My Orders", hint: "Track and view past orders", icon: Package, href: "/account/orders" },
  { label: "My Addresses", hint: "Saved delivery addresses", icon: MapPin, href: "/account/addresses" },
  { label: "My Monthly List", hint: "Your regular items, ready to reorder", icon: ClipboardList, href: null },
  { label: "Help / Contact", hint: "Call us, delivery times, how to order", icon: CircleHelp, href: "/help" },
] as const;

export default function AccountPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">My account</h1>
      <Suspense fallback={<BlockSkeleton />}>
        <AccountContent />
      </Suspense>
    </>
  );
}

async function AccountContent() {
  const user = await getCurrentUser();

  return (
    <>
      {user ? (
        <p className="mb-4 rounded-xl bg-secondary p-3 text-base">
          Signed in as <strong>{user.fullName || "Customer"}</strong>
          {user.phone && <> · {formatPkMobile(user.phone)}</>}
        </p>
      ) : (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <p className="text-base">Sign in to place orders and see your order history.</p>
          <Link
            href="/login"
            className="flex h-14 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground"
          >
            Sign in
          </Link>
          <Link href="/signup" className="flex h-12 items-center justify-center rounded-xl border-2 text-base font-semibold">
            Create an account
          </Link>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {SECTIONS.map(({ label, hint, icon: Icon, href }) => {
          // Signed-out visitors are sent to sign in first, then brought back.
          const target = href && !user && href !== "/help" ? `/login?next=${encodeURIComponent(href)}` : href;
          const body = (
            <>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon className="size-6" />
              </span>
              <span className="flex-1">
                <span className="block text-lg font-semibold">{label}</span>
                <span className="block text-sm text-muted-foreground">{hint}</span>
              </span>
              {target ? (
                <ChevronRight className="size-6 text-muted-foreground" />
              ) : (
                <span className="text-sm text-muted-foreground">Soon</span>
              )}
            </>
          );
          return (
            <li key={label}>
              {target ? (
                <Link href={target} className="flex min-h-20 items-center gap-3 rounded-2xl border bg-card p-3">
                  {body}
                </Link>
              ) : (
                <div aria-disabled className="flex min-h-20 items-center gap-3 rounded-2xl border bg-card p-3 opacity-70">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {user && (
        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 text-base font-semibold text-muted-foreground"
          >
            <LogOut className="size-5" />
            Sign out
          </button>
        </form>
      )}
    </>
  );
}
