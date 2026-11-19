"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { refreshCartItems } from "@/app/(shop)/cart/actions";
import { cart, useCart } from "@/lib/cart-store";

/** Puts this order's items back in the cart at TODAY's prices; items no longer sold are skipped. */
export function ReorderButton({ items }: { items: { id: string | null; qty: number }[] }) {
  const router = useRouter();
  const lines = useCart();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reorder() {
    setMessage(null);
    startTransition(async () => {
      try {
        const wanted = items.filter((i): i is { id: string; qty: number } => !!i.id);
        const fresh = await refreshCartItems(wanted.map((i) => i.id));
        for (const f of fresh) {
          const qty = wanted.find((w) => w.id === f.id)?.qty ?? 1;
          const have = lines.find((l) => l.id === f.id)?.qty ?? 0;
          cart.add(f);
          cart.setQty(f.id, have + qty);
        }
        if (fresh.length === 0) {
          setMessage("Sorry, these items are no longer available.");
          return;
        }
        router.push("/cart");
      } catch {
        setMessage("No internet connection? Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {message && <p className="rounded-xl bg-notice p-3 text-base text-notice-foreground">{message}</p>}
      <button
        type="button"
        onClick={reorder}
        disabled={pending}
        className="flex h-14 items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-60"
      >
        <RotateCcw className="size-5" />
        {pending ? "Adding to cart…" : "Order these items again"}
      </button>
    </div>
  );
}
