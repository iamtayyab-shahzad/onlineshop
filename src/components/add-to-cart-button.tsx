"use client";

import { Minus, Plus } from "lucide-react";
import { cart, useCart, type CartLine } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

type Props = {
  item: Omit<CartLine, "qty">;
  size?: "default" | "lg";
  className?: string;
};

/** "Add" button that turns into a − qty + stepper once the item is in the cart. */
export function AddToCartButton({ item, size = "default", className }: Props) {
  const qty = useCart().find((l) => l.id === item.id)?.qty ?? 0;
  const height = size === "lg" ? "h-14 text-lg" : "h-12 text-base";

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => cart.add(item)}
        className={cn(
          "w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground active:bg-primary/85",
          height,
          className,
        )}
      >
        Add to cart
      </button>
    );
  }

  return <QtyStepper id={item.id} name={item.name} qty={qty} className={cn(height, className)} />;
}

export function QtyStepper({
  id,
  name,
  qty,
  className,
}: {
  id: string;
  name: string;
  qty: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-12 w-full items-center justify-between overflow-hidden rounded-xl border-2 border-primary bg-background",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => cart.setQty(id, qty - 1)}
        aria-label={qty === 1 ? `Remove ${name}` : `One less ${name}`}
        className="flex h-full w-14 items-center justify-center text-primary active:bg-primary/10"
      >
        <Minus className="size-6" />
      </button>
      <span className="text-lg font-bold tabular-nums" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        onClick={() => cart.setQty(id, qty + 1)}
        disabled={qty >= cart.MAX_QTY}
        aria-label={`One more ${name}`}
        className="flex h-full w-14 items-center justify-center text-primary active:bg-primary/10 disabled:opacity-40"
      >
        <Plus className="size-6" />
      </button>
    </div>
  );
}
