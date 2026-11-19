import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CircleCheck, ShieldAlert } from "lucide-react";
import { BlockSkeleton } from "@/components/skeletons";
import { requireUser } from "@/lib/auth";
import { getMyOrder } from "@/lib/account";
import { getPaymentDetails, getStoreSettings } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { PAYMENT_LABEL } from "@/lib/orders";
import { formatPkMobile } from "@/lib/phone";
import { PayDetails } from "@/components/pay-details";
import { PaymentProofForm } from "@/components/payment-proof-form";

export const metadata: Metadata = { title: "Order placed" };

export default function SuccessPage({ params }: PageProps<"/checkout/success/[id]">) {
  return (
    <div className="mx-auto max-w-md">
      <Suspense fallback={<BlockSkeleton />}>
        <Success params={params} />
      </Suspense>
    </div>
  );
}

async function Success({ params }: { params: PageProps<"/checkout/success/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser(`/account/orders/${encodeURIComponent(id)}`);
  const order = await getMyOrder(user.id, id);
  if (!order) notFound();
  const [pay, settings] = await Promise.all([getPaymentDetails(), getStoreSettings()]);
  const needsTransfer = order.payment_method !== "cod";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-secondary p-6 text-center">
        <CircleCheck className="size-16 text-primary" />
        <h1 className="text-2xl font-bold">Thank you! Your order is placed.</h1>
        <p className="text-lg">
          Order number <strong>{order.order_number}</strong>
        </p>
        <p className="text-lg">
          Total <strong>{formatPrice(order.total)}</strong> · {PAYMENT_LABEL[order.payment_method]}
        </p>
      </div>

      <section className="rounded-2xl border bg-card p-4 text-base">
        <h2 className="mb-2 text-lg font-bold">What happens next</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>We check your order and may call you to confirm.</li>
          {needsTransfer && <li>Send the payment using the details below. We check it ourselves before delivery.</li>}
          <li>We prepare your items and deliver them{settings.delivery_hours ? ` (${settings.delivery_hours})` : ""}.</li>
          <li>You can follow your order any time in My Orders.</li>
        </ol>
      </section>

      {needsTransfer && (
        <>
          <PayDetails method={order.payment_method} pay={pay} total={order.total} orderNumber={order.order_number} />
          <PaymentProofForm orderId={order.id} userId={user.id} />
        </>
      )}

      <p className="flex gap-3 rounded-2xl bg-notice p-4 text-base text-notice-foreground">
        <ShieldAlert className="size-6 shrink-0" />
        <span>
          We will <strong>never</strong> ask for your PIN, password, card CVV or one-time code. Do not share them with
          anyone, even if they say they are from our shop.
        </span>
      </p>

      {settings.support_phone && (
        <a
          href={`tel:${settings.support_phone}`}
          className="flex h-12 items-center justify-center rounded-xl border-2 text-base font-semibold"
        >
          Questions? Call {formatPkMobile(settings.support_phone)}
        </a>
      )}
      <Link
        href={`/account/orders/${order.id}`}
        className="flex h-14 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground"
      >
        View my order
      </Link>
      <Link href="/" className="flex h-12 items-center justify-center rounded-xl text-base font-semibold text-primary">
        Continue shopping
      </Link>
    </div>
  );
}
