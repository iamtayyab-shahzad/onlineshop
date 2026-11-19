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

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold break-all">{value}</dd>
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
        <section className="rounded-2xl border-2 border-primary bg-card p-4">
          <h2 className="mb-3 text-lg font-bold">
            {order.payment_method === "jazzcash" ? "Send to our JazzCash account" : "Send to our bank account"}
          </h2>
          <dl className="flex flex-col gap-2">
            {order.payment_method === "jazzcash" ? (
              <>
                <Row label="JazzCash number" value={pay.jazzcash_number} />
                <Row label="Account name" value={pay.jazzcash_account_name} />
              </>
            ) : (
              <>
                <Row label="Bank" value={pay.bank_name} />
                <Row label="Account title" value={pay.bank_account_title} />
                <Row label="Account number" value={pay.bank_account_number} />
                <Row label="IBAN" value={pay.bank_iban} />
              </>
            )}
            <Row label="Amount" value={formatPrice(order.total)} />
            <Row label="Reference (write this in the message)" value={String(order.order_number)} />
          </dl>
          {!(order.payment_method === "jazzcash" ? pay.jazzcash_number : pay.bank_account_number) && (
            <p className="mt-2 text-base">We will call you with the payment details.</p>
          )}
        </section>
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
