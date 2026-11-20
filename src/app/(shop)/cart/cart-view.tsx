"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Trash2 } from "lucide-react";
import { cart, lineTotal, ruleOf, useCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { formatQty } from "@/lib/quantity";
import { QtyStepper } from "@/components/add-to-cart-button";
import { SaveCartButton } from "@/components/save-to-monthly";
import { refreshCartItems } from "./actions";

const noop = () => () => {};

export function CartView({ deliveryFee, minOrder }: { deliveryFee: number; minOrder: number }) {
  const lines = useCart();
  // false during server render and hydration, true once the cart is read from the device.
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const [notice, setNotice] = useState<string | null>(null);
  const refreshed = useRef(false);

  // Once per visit, update prices and drop items that are no longer sold.
  useEffect(() => {
    if (!ready || refreshed.current || lines.length === 0) return;
    refreshed.current = true;
    refreshCartItems(lines.map((l) => l.id))
      .then((fresh) => {
        const changed = cart.sync(new Map(fresh.map((f) => [f.id, f])));
        if (changed) setNotice("Some prices or items have changed. Your cart has been updated.");
      })
      .catch(() => {
        // Offline: keep showing the saved cart; prices are re-checked at checkout.
      });
  }, [ready, lines]);

  if (!ready) {
    return <div className="h-40 animate-pulse rounded-2xl bg-muted" aria-busy="true" />;
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-2xl bg-muted p-8 text-center">
        <p className="text-5xl" aria-hidden>
          🛒
        </p>
        <p className="mt-3 text-lg font-semibold">Your cart is empty</p>
        <Link
          href="/"
          className="mt-4 inline-flex h-12 items-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const total = subtotal + deliveryFee;
  const shortBy = Math.max(minOrder - subtotal, 0);
  const itemCount = lines.length;

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <p role="status" className="rounded-xl bg-notice p-3 text-base text-notice-foreground">
          {notice}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {lines.map((l) => (
          <li key={l.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-3">
            <div className="flex items-start gap-3">
              {l.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- small resized WebP from Supabase Storage
                <img src={l.image} alt="" className="size-14 shrink-0 rounded-xl bg-muted object-contain" />
              ) : (
                <div
                  aria-hidden
                  className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-3xl"
                >
                  {l.icon ?? "🛒"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link href={`/product/${l.slug}`} className="text-base leading-snug font-semibold">
                  {l.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {l.unit} · {formatPrice(l.price)} {ruleOf(l).unitName ? `per ${ruleOf(l).unitName}` : "each"}
                </p>
                {l.amount ? (
                  <p className="text-sm font-medium text-primary">
                    {formatPrice(l.amount)} worth · about {formatQty(l.qty, ruleOf(l).unitName)}
                  </p>
                ) : (
                  ruleOf(l).decimal && <p className="text-sm font-medium">{formatQty(l.qty, ruleOf(l).unitName)}</p>
                )}
              </div>
              <p className="text-lg font-bold tabular-nums">{formatPrice(lineTotal(l))}</p>
            </div>
            <div className="flex items-center gap-3">
              {l.amount ? (
                <Link
                  href={`/product/${l.slug}`}
                  className="flex h-12 items-center rounded-xl border-2 px-4 text-base font-semibold"
                >
                  Change amount
                </Link>
              ) : (
                <QtyStepper id={l.id} name={l.name} qty={l.qty} className="max-w-44" />
              )}
              <button
                type="button"
                onClick={() => cart.remove(l.id)}
                className="ml-auto flex h-12 items-center gap-1.5 rounded-xl px-3 text-base font-medium text-destructive active:bg-destructive/10"
              >
                <Trash2 className="size-5" />
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <section aria-label="Order summary" className="rounded-2xl border bg-card p-4 text-lg">
        <dl className="flex flex-col gap-2">
          <div className="flex justify-between">
            <dt>
              Items ({itemCount})
            </dt>
            <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Delivery</dt>
            <dd className="tabular-nums">{formatPrice(deliveryFee)}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-xl font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPrice(total)}</dd>
          </div>
        </dl>
      </section>

      {shortBy > 0 ? (
        <p className="rounded-xl bg-notice p-3 text-base text-notice-foreground">
          Minimum order is {formatPrice(minOrder)}. Add {formatPrice(shortBy)} more to check out.
        </p>
      ) : null}

      <Link
        href={shortBy > 0 ? "/" : "/checkout"}
        className="flex h-14 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground"
      >
        {shortBy > 0 ? "Add more items" : "Continue to checkout"}
      </Link>
      <SaveCartButton />
    </div>
  );
}
