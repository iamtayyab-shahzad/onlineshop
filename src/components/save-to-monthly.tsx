"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ClipboardList } from "lucide-react";
import { saveToMonthlyList } from "@/app/(shop)/account/monthly/actions";
import { ruleOf, useCart, type CartItem } from "@/lib/cart-store";

function useSave(returnTo: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function save(items: { id: string; qty: number; amount: number | null }[]) {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await saveToMonthlyList(items);
        if (res.needLogin) {
          router.push(`/login?next=${encodeURIComponent(returnTo)}`);
          return;
        }
        setMessage(
          res.ok
            ? { ok: true, text: `Saved ${res.saved === 1 ? "1 item" : `${res.saved} items`} to your monthly list.` }
            : { ok: false, text: res.error ?? "Could not save." },
        );
      } catch {
        setMessage({ ok: false, text: "No internet connection? Please try again." });
      }
    });
  }
  return { save, pending, message };
}

function Feedback({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return (
    <p role="status" className={`text-base font-medium ${message.ok ? "text-primary" : "text-destructive"}`}>
      {message.text}
      {message.ok && (
        <>
          {" "}
          <Link href="/account/monthly" className="underline">
            View list
          </Link>
        </>
      )}
    </p>
  );
}

/** Product page: save this product (the amount in your cart, or the smallest amount) for next month. */
export function SaveProductButton({ item }: { item: CartItem }) {
  const line = useCart().find((l) => l.id === item.id);
  const { save, pending, message } = useSave(`/product/${item.slug}`);
  const rule = ruleOf(item);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          save([
            line
              ? { id: item.id, qty: line.qty, amount: line.amount ?? null }
              : rule.method === "amount"
                ? { id: item.id, qty: 1, amount: rule.minAmount ?? null }
                : { id: item.id, qty: rule.min, amount: null },
          ])
        }
        className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 text-base font-semibold disabled:opacity-60"
      >
        <ClipboardList className="size-5" />
        {pending ? "Saving…" : "Save to my monthly list"}
      </button>
      <Feedback message={message} />
    </div>
  );
}

/** Cart page: save everything in the cart as the monthly list. */
export function SaveCartButton() {
  const lines = useCart();
  const { save, pending, message } = useSave("/cart");
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => save(lines.map((l) => ({ id: l.id, qty: l.qty, amount: l.amount ?? null })))}
        className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 text-base font-semibold disabled:opacity-60"
      >
        <ClipboardList className="size-5" />
        {pending ? "Saving…" : "Save these to my monthly list"}
      </button>
      <Feedback message={message} />
    </div>
  );
}
