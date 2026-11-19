import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTitle } from "@/components/page-title";
import { BlockSkeleton } from "@/components/skeletons";
import { requireUser } from "@/lib/auth";
import { getMyAddresses } from "@/lib/account";
import { availablePaymentMethods, getPaymentDetails, getStoreSettings } from "@/lib/catalog";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Checkout" backHref="/cart" backLabel="Cart" />
      <Suspense fallback={<BlockSkeleton />}>
        <Checkout searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Checkout({ searchParams }: { searchParams: PageProps<"/checkout">["searchParams"] }) {
  const user = await requireUser("/checkout");
  const [{ address: picked }, addresses, settings, pay] = await Promise.all([
    searchParams,
    getMyAddresses(user.id),
    getStoreSettings(),
    getPaymentDetails(),
  ]);
  // A just-added address (?address=<id>) is pre-selected, otherwise the main one.
  const selected =
    addresses.find((a) => a.id === picked)?.id ?? addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null;

  return (
    <CheckoutForm
      addresses={addresses}
      selectedAddressId={selected}
      deliveryFee={settings.delivery_fee}
      minOrder={settings.min_order_amount}
      paymentMethods={availablePaymentMethods(pay)}
    />
  );
}
