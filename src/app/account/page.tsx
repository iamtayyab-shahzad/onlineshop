import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CircleHelp, ClipboardList, MapPin, Package, UserRound } from "lucide-react";

export const metadata: Metadata = { title: "My account" };

// Exactly five sections, as agreed. Sign-in and the first four sections
// arrive in Stage 2 (profile, orders, addresses) and Stage 5 (monthly list).
const SECTIONS = [
  { label: "Profile", hint: "Your name and phone number", icon: UserRound, href: null },
  { label: "My Orders", hint: "Track and view past orders", icon: Package, href: null },
  { label: "My Addresses", hint: "Saved delivery addresses", icon: MapPin, href: null },
  { label: "My Monthly List", hint: "Your regular items, ready to reorder", icon: ClipboardList, href: null },
  { label: "Help / Contact", hint: "Call us, delivery times, how to order", icon: CircleHelp, href: "/help" },
] as const;

export default function AccountPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">My account</h1>
      <p className="mb-4 rounded-xl bg-notice p-3 text-base text-notice-foreground">
        Sign-in with your phone number is coming in the next update.
      </p>
      <ul className="flex flex-col gap-3">
        {SECTIONS.map(({ label, hint, icon: Icon, href }) => {
          const body = (
            <>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon className="size-6" />
              </span>
              <span className="flex-1">
                <span className="block text-lg font-semibold">{label}</span>
                <span className="block text-sm text-muted-foreground">{hint}</span>
              </span>
              {href ? (
                <ChevronRight className="size-6 text-muted-foreground" />
              ) : (
                <span className="text-sm text-muted-foreground">Soon</span>
              )}
            </>
          );
          return (
            <li key={label}>
              {href ? (
                <Link href={href} className="flex min-h-20 items-center gap-3 rounded-2xl border bg-card p-3">
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
    </>
  );
}
