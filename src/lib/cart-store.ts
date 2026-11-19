"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_RULE, amountToQty, isValidAmount, qtyLineTotal, snapQty, type QtyRule } from "@/lib/quantity";

/**
 * The cart lives on the customer's device (localStorage) so it works before
 * sign-in and survives closing the app. Prices stored here are for display
 * only: the cart page refreshes them from the server, and at checkout the
 * database recalculates every price, quantity and total itself.
 *
 * A line is either a QUANTITY line (qty) or an AMOUNT line ("Rs 150 of
 * potatoes": amount set, qty is the calculated estimate).
 */
export type CartLine = {
  id: string;
  slug: string;
  name: string;
  unit: string;
  price: number;
  icon: string | null;
  image?: string | null;
  rule?: QtyRule;
  qty: number;
  amount?: number | null;
};

export type CartItem = Omit<CartLine, "qty" | "amount">;

const KEY = "grocery-cart-v1";
const EMPTY: CartLine[] = [];

let cachedRaw: string | null = null;
let cachedLines: CartLine[] = EMPTY;
const listeners = new Set<() => void>();

export const ruleOf = (l: { rule?: QtyRule }) => l.rule ?? DEFAULT_RULE;

/** What this line costs, as the database will calculate it. */
export function lineTotal(l: CartLine): number {
  return l.amount ? l.amount : qtyLineTotal(l.price, l.qty);
}

function read(): CartLine[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cachedLines;
  }
  if (raw === cachedRaw) return cachedLines;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedLines = Array.isArray(parsed)
      ? parsed.filter(
          (l): l is CartLine =>
            typeof l?.id === "string" &&
            typeof l?.name === "string" &&
            typeof l?.price === "number" &&
            typeof l?.qty === "number" &&
            Number.isFinite(l.qty) &&
            l.qty > 0,
        )
      : EMPTY;
  } catch {
    cachedLines = EMPTY;
  }
  return cachedLines;
}

function write(lines: CartLine[]) {
  const raw = JSON.stringify(lines);
  cachedRaw = raw;
  cachedLines = lines;
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    // Storage full or blocked: the cart still works for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Number of different items in the cart (quantities can be 1.5 kg, so we count lines). */
export function useCartCount(): number {
  return useCart().length;
}

export const cart = {
  /** Add one step of a product (or its minimum) as a quantity line. */
  add(item: CartItem) {
    const lines = read();
    const existing = lines.find((l) => l.id === item.id);
    const rule = ruleOf(item);
    if (existing && !existing.amount) {
      cart.setQty(item.id, existing.qty + rule.step);
    } else {
      const qty = snapQty(rule.min, rule) || rule.min;
      const others = lines.filter((l) => l.id !== item.id);
      write([...others, { ...item, qty, amount: null }]);
    }
  },
  setQty(id: string, qty: number) {
    const lines = read();
    const line = lines.find((l) => l.id === id);
    if (!line) return;
    const next = snapQty(qty, ruleOf(line));
    write(
      next === 0
        ? lines.filter((l) => l.id !== id)
        : lines.map((l) => (l.id === id ? { ...l, qty: next, amount: null } : l)),
    );
  },
  /** Buy by amount: "Rs 150 of potatoes". Replaces any quantity line for this product. */
  setAmount(item: CartItem, amount: number) {
    const rule = ruleOf(item);
    if (!isValidAmount(amount, rule)) return false;
    const lines = read().filter((l) => l.id !== item.id);
    write([...lines, { ...item, amount, qty: amountToQty(amount, item.price) }]);
    return true;
  },
  remove(id: string) {
    write(read().filter((l) => l.id !== id));
  },
  /** Replace stored prices/names/rules with fresh server values; drop unavailable items. */
  sync(fresh: Map<string, CartItem>) {
    const lines = read();
    const next: CartLine[] = [];
    for (const l of lines) {
      const f = fresh.get(l.id);
      if (!f) continue;
      const rule = ruleOf(f);
      if (l.amount) {
        if (isValidAmount(l.amount, rule)) next.push({ ...f, amount: l.amount, qty: amountToQty(l.amount, f.price) });
        else if (rule.method !== "amount") {
          const qty = snapQty(amountToQty(l.amount, f.price), rule);
          if (qty) next.push({ ...f, qty, amount: null });
        }
      } else if (rule.method !== "amount") {
        const qty = snapQty(l.qty, rule);
        if (qty) next.push({ ...f, qty, amount: null });
      }
    }
    const changed = JSON.stringify(next) !== JSON.stringify(lines);
    if (changed) write(next);
    return changed;
  },
  clear() {
    write([]);
  },
};
