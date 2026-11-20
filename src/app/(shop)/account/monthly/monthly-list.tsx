"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { cart, ruleOf, type CartItem } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { formatQty, qtyLineTotal } from "@/lib/quantity";
import { removeFromMonthlyList, setMonthlyQty } from "./actions";

export type MonthlyEntry = {
  productId: string;
  qty: number;
  amount: number | null;
  /** null when the product is no longer sold or is out of stock */
  item: CartItem | null;
  name: string;
};

/** The customer's saved list: change quantities, remove items, add everything to the cart in one tap. */
export function MonthlyListView({ entries }: { entries: MonthlyEntry[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const available = entries.filter((e) => e.item);

  const total = available.reduce(
    (sum, e) => sum + (e.amount ? e.amount : qtyLineTotal(e.item!.price, e.qty)),
    0,
  );

  function run(fn: () => Promise<{ ok: boolean; error?: string; needLogin?: boolean }>) {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fn();
        if (res.needLogin) router.push("/login?next=/account/monthly");
        else if (!res.ok) setMessage(res.error ?? "Something went wrong.");
      } catch {
        setMessage("No internet connection? Please try again.");
      }
    });
  }

  function addAll() {
    for (const e of available) {
      const item = e.item!;
      if (e.amount && cart.setAmount(item, e.amount)) continue;
      cart.add(item);
      cart.setQty(item.id, e.qty);
    }
    router.push("/cart");
  }

  return (
    <div className="flex flex-col gap-4">
      {available.length > 0 && (
        <button
          type="button"
          onClick={addAll}
          className="flex h-14 items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground"
        >
          <ShoppingCart className="size-5" />
          Add all to cart · about {formatPrice(total)}
        </button>
      )}
      {message && (
        <p role="alert" className="rounded-xl bg-notice p-3 text-base text-notice-foreground">
          {message}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {entries.map((e) => {
          const rule = e.item ? ruleOf(e.item) : null;
          const step = rule?.step ?? 1;
          return (
            <li key={e.productId} className="flex flex-col gap-2 rounded-2xl border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg leading-snug font-semibold">{e.item?.name ?? e.name}</p>
                  {e.item ? (
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(e.item.price)} per {e.item.unit}
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-destructive">Not available right now</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeFromMonthlyList(e.productId))}
                  aria-label={`Remove ${e.item?.name ?? e.name}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground active:bg-muted"
                >
                  <Trash2 className="size-5" />
                </button>
              </div>

              {e.item &&
                (e.amount ? (
                  <p className="text-base font-semibold">{formatPrice(e.amount)} worth</p>
                ) : (
                  <div className="flex h-12 items-center justify-between overflow-hidden rounded-xl border-2 border-primary">
                    <button
                      type="button"
                      disabled={pending || e.qty - step < (rule?.min ?? 1)}
                      onClick={() => run(() => setMonthlyQty(e.productId, e.qty - step))}
                      aria-label={`Less ${e.item.name}`}
                      className="flex h-full w-14 items-center justify-center text-primary active:bg-primary/10 disabled:opacity-40"
                    >
                      <Minus className="size-6" />
                    </button>
                    <span className="text-lg font-bold tabular-nums">
                      {formatQty(e.qty, rule?.decimal ? rule.unitName : undefined)}
                    </span>
                    <button
                      type="button"
                      disabled={pending || e.qty + step > (rule?.max ?? Infinity)}
                      onClick={() => run(() => setMonthlyQty(e.productId, e.qty + step))}
                      aria-label={`More ${e.item.name}`}
                      className="flex h-full w-14 items-center justify-center text-primary active:bg-primary/10 disabled:opacity-40"
                    >
                      <Plus className="size-6" />
                    </button>
                  </div>
                ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
