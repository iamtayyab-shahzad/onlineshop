import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/page-title";

export const metadata: Metadata = { title: "Checkout" };

// Stage 2 replaces this page with sign-in, saved addresses, payment choice
// and a server-side order RPC that recalculates every price.
export default function CheckoutPage() {
  return (
    <>
      <PageTitle title="Checkout" backHref="/cart" backLabel="Cart" />
      <div className="rounded-2xl bg-notice p-5 text-lg text-notice-foreground">
        <p className="font-semibold">Online ordering is coming very soon.</p>
        <p className="mt-2 text-base">
          Your cart is saved on this phone. You will be able to sign in, choose your address and place the order
          here in the next update.
        </p>
      </div>
      <Link
        href="/help"
        className="mt-4 flex h-12 items-center justify-center rounded-xl border-2 text-base font-semibold"
      >
        Contact us
      </Link>
    </>
  );
}
