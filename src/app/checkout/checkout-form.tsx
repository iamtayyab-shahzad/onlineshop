"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Plus } from "lucide-react";
import { FormError } from "@/components/form";
import type { Address } from "@/lib/account";
import { cart, useCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { PAYMENT_LABEL, type PaymentMethod } from "@/lib/orders";
import { placeOrder } from "./actions";

const noop = () => () => {};

const PAYMENT_HINT: Record<PaymentMethod, string> = {
  cod: "Pay in cash when your order arrives.",
  jazzcash: "We will show you our JazzCash number after you order. We confirm payment before delivery.",
  bank_transfer: "We will show you our bank details after you order. We confirm payment before delivery.",
};

export function CheckoutForm({
  addresses,
  selectedAddressId,
  deliveryFee,
  minOrder,
}: {
  addresses: Address[];
  selectedAddressId: string | null;
  deliveryFee: number;
  minOrder: number;
}) {
  const router = useRouter();
  const lines = useCart();
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const [addressId, setAddressId] = useState(selectedAddressId);
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  // One id per checkout attempt: pressing the button twice never makes two orders.
  const requestId = useRef<string | null>(null);

  if (!ready) return <div className="h-60 animate-pulse rounded-2xl bg-muted" aria-busy="true" />;
  if (done) return <p className="rounded-2xl bg-secondary p-6 text-center text-lg font-semibold">Order placed! Opening it…</p>;

  if (lines.length === 0) {
    return (
      <div className="rounded-2xl bg-muted p-8 text-center">
        <p className="text-lg font-semibold">Your cart is empty</p>
        <Link
          href="/"
          className="mt-4 inline-flex h-12 items-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  const belowMin = subtotal < minOrder;

  function submit() {
    setError(null);
    if (!addressId) {
      setError("Please add a delivery address first.");
      return;
    }
    requestId.current ??= crypto.randomUUID();
    startTransition(async () => {
      try {
        const res = await placeOrder({
          items: lines.map((l) => ({ id: l.id, qty: l.qty })),
          addressId,
          paymentMethod: payment,
          note,
          requestId: requestId.current,
        });
        if (res.ok) {
          setDone(true);
          cart.clear();
          router.replace(`/checkout/success/${res.id}`);
        } else {
          setError(res.error);
          setErrorCode(res.code);
          // The cart changed on the server's side: next attempt is a new order request.
          if (res.code === "item_unavailable" || res.code === "below_minimum") requestId.current = null;
        }
      } catch {
        setError("No internet connection? Please check and press Place order again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="h-address" className="flex flex-col gap-3">
        <h2 id="h-address" className="text-xl font-bold">
          1. Delivery address
        </h2>
        {addresses.map((a) => (
          <label
            key={a.id}
            className="flex items-start gap-3 rounded-2xl border-2 bg-card p-4 text-base has-checked:border-primary has-checked:bg-secondary"
          >
            <input
              type="radio"
              name="address"
              checked={addressId === a.id}
              onChange={() => setAddressId(a.id)}
              className="mt-1 size-5 accent-primary"
            />
            <span>
              <span className="block font-semibold">
                {a.label} · {a.recipient_name}
              </span>
              <span className="block">
                {a.address_line}, {a.area}
              </span>
              {a.landmark && <span className="block text-muted-foreground">Near: {a.landmark}</span>}
            </span>
          </label>
        ))}
        <Link
          href="/account/addresses/new?next=%2Fcheckout"
          className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 text-base font-semibold"
        >
          <Plus className="size-5" /> {addresses.length ? "Add another address" : "Add delivery address"}
        </Link>
      </section>

      <section aria-labelledby="h-pay" className="flex flex-col gap-3">
        <h2 id="h-pay" className="text-xl font-bold">
          2. How will you pay?
        </h2>
        {(Object.keys(PAYMENT_HINT) as PaymentMethod[]).map((m) => (
          <label
            key={m}
            className="flex items-start gap-3 rounded-2xl border-2 bg-card p-4 has-checked:border-primary has-checked:bg-secondary"
          >
            <input
              type="radio"
              name="payment"
              checked={payment === m}
              onChange={() => setPayment(m)}
              className="mt-1 size-5 accent-primary"
            />
            <span>
              <span className="block text-lg font-semibold">{PAYMENT_LABEL[m]}</span>
              <span className="block text-sm text-muted-foreground">{PAYMENT_HINT[m]}</span>
            </span>
          </label>
        ))}
      </section>

      <section aria-labelledby="h-note" className="flex flex-col gap-2">
        <h2 id="h-note" className="text-xl font-bold">
          3. Note for us (optional)
        </h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="e.g. Please call when you arrive"
          className="rounded-xl border-2 bg-background p-3 text-lg"
        />
      </section>

      <section aria-label="Order summary" className="rounded-2xl border bg-card p-4 text-lg">
        <dl className="flex flex-col gap-2">
          <div className="flex justify-between">
            <dt>Items ({itemCount})</dt>
            <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Delivery</dt>
            <dd className="tabular-nums">{formatPrice(deliveryFee)}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-xl font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPrice(subtotal + deliveryFee)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-sm text-muted-foreground">Final prices are checked when you place the order.</p>
      </section>

      <FormError message={error ?? undefined} />
      {(errorCode === "item_unavailable" || errorCode === "below_minimum" || belowMin) && (
        <Link href="/cart" className="flex h-12 items-center justify-center rounded-xl border-2 text-base font-semibold">
          Go back to cart
        </Link>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending || belowMin}
        className="flex h-14 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Placing order…" : belowMin ? `Minimum order ${formatPrice(minOrder)}` : "Place order"}
      </button>
    </div>
  );
}
