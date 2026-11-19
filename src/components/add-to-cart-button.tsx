"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cart, ruleOf, useCart, type CartItem } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { amountToQty, formatQty, isValidAmount } from "@/lib/quantity";
import { cn } from "@/lib/utils";

type Props = {
  item: CartItem;
  inStock?: boolean;
  size?: "default" | "lg";
  className?: string;
};

/** "Add" button that turns into a − qty + stepper once the item is in the cart. */
export function AddToCartButton({ item, inStock = true, size = "default", className }: Props) {
  const line = useCart().find((l) => l.id === item.id);
  const rule = ruleOf(item);
  const height = size === "lg" ? "h-14 text-lg" : "h-12 text-base";

  if (!inStock) {
    return (
      <p className={cn("flex items-center justify-center rounded-xl bg-muted px-4 font-semibold text-muted-foreground", height, className)}>
        Out of stock
      </p>
    );
  }

  if (line?.amount) {
    return (
      <p className={cn("flex items-center justify-center rounded-xl border-2 border-primary px-3 text-center font-semibold text-primary", height, className)}>
        {formatPrice(line.amount)} in cart
      </p>
    );
  }

  if (!line) {
    if (rule.method === "amount") {
      // Amount-only items (e.g. loose vegetables): add the minimum amount; change it in the cart or product page.
      return (
        <button
          type="button"
          onClick={() => cart.setAmount(item, rule.minAmount ?? 0)}
          className={cn("w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground active:bg-primary/85", height, className)}
        >
          Add {formatPrice(rule.minAmount ?? 0)}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => cart.add(item)}
        className={cn("w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground active:bg-primary/85", height, className)}
      >
        Add to cart
      </button>
    );
  }

  return <QtyStepper id={item.id} name={item.name} qty={line.qty} className={cn(height, className)} />;
}

export function QtyStepper({ id, name, qty, className }: { id: string; name: string; qty: number; className?: string }) {
  const line = useCart().find((l) => l.id === id);
  const rule = line ? ruleOf(line) : null;
  const step = rule?.step ?? 1;
  const atMax = rule ? qty >= rule.max : false;
  const atMin = rule ? qty - step < rule.min : qty <= 1;
  return (
    <div
      className={cn(
        "flex h-12 w-full items-center justify-between overflow-hidden rounded-xl border-2 border-primary bg-background",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => cart.setQty(id, qty - step)}
        aria-label={atMin ? `Remove ${name}` : `Less ${name}`}
        className="flex h-full w-14 items-center justify-center text-primary active:bg-primary/10"
      >
        <Minus className="size-6" />
      </button>
      <span className="text-lg font-bold tabular-nums" aria-live="polite">
        {formatQty(qty, rule?.unitName && rule.decimal ? rule.unitName : undefined)}
      </span>
      <button
        type="button"
        onClick={() => cart.setQty(id, qty + step)}
        disabled={atMax}
        aria-label={`More ${name}`}
        className="flex h-full w-14 items-center justify-center text-primary active:bg-primary/10 disabled:opacity-40"
      >
        <Plus className="size-6" />
      </button>
    </div>
  );
}

/** "Buy by amount": the customer types or taps an amount, we show the quantity they get. */
export function AmountPicker({ item, className }: { item: CartItem; className?: string }) {
  const rule = ruleOf(item);
  const line = useCart().find((l) => l.id === item.id);
  const min = rule.minAmount ?? 0;
  const [value, setValue] = useState(String(line?.amount ?? min));
  const [message, setMessage] = useState<string | null>(null);
  const amount = Number(value);
  const valid = isValidAmount(amount, rule);
  const presets = [min, 100, 200, 500, 1000].filter(
    (a, i, arr) => a >= min && (rule.maxAmount == null || a <= rule.maxAmount) && arr.indexOf(a) === i,
  );

  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border-2 bg-card p-4", className)}>
      <p className="text-lg font-bold">Buy by amount</p>
      <div className="flex flex-wrap gap-2">
        {presets.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setValue(String(a))}
            className={cn(
              "h-11 rounded-xl border-2 px-4 text-base font-semibold",
              amount === a ? "border-primary bg-secondary" : "",
            )}
          >
            {formatPrice(a)}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-base font-semibold">
        Or type an amount (Rs)
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          className="h-12 rounded-xl border-2 bg-background px-4 text-lg"
        />
      </label>
      <p className="text-base" aria-live="polite">
        {valid ? (
          <>
            You get about <strong>{formatQty(amountToQty(amount, item.price), rule.unitName)}</strong> for{" "}
            <strong>{formatPrice(amount)}</strong>
          </>
        ) : (
          <span className="text-destructive">
            Minimum {formatPrice(min)}
            {rule.maxAmount != null && `, maximum ${formatPrice(rule.maxAmount)}`}. Whole rupees only.
          </span>
        )}
      </p>
      <button
        type="button"
        disabled={!valid}
        onClick={() => {
          if (cart.setAmount(item, amount)) setMessage(`${formatPrice(amount)} of ${item.name} is in your cart.`);
        }}
        className="h-14 rounded-xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-50"
      >
        {line?.amount ? "Update cart" : "Add to cart"}
      </button>
      {message && (
        <p role="status" className="rounded-xl bg-secondary p-3 text-base">
          {message}
        </p>
      )}
    </div>
  );
}
