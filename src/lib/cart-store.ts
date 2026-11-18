"use client";

import { useSyncExternalStore } from "react";

/**
 * The cart lives on the customer's device (localStorage) so it works before
 * sign-in and survives closing the app. Prices stored here are for display
 * only: the cart page refreshes them from the server, and at checkout
 * (Stage 2) the server recalculates every price itself.
 */
export type CartLine = {
  id: string;
  slug: string;
  name: string;
  unit: string;
  price: number;
  icon: string | null;
  qty: number;
};

const KEY = "grocery-cart-v1";
const MAX_QTY = 50;
const EMPTY: CartLine[] = [];

let cachedRaw: string | null = null;
let cachedLines: CartLine[] = EMPTY;
const listeners = new Set<() => void>();

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
            Number.isInteger(l?.qty) &&
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

export function useCartCount(): number {
  return useCart().reduce((n, l) => n + l.qty, 0);
}

export const cart = {
  add(item: Omit<CartLine, "qty">) {
    const lines = read();
    const existing = lines.find((l) => l.id === item.id);
    if (existing) {
      cart.setQty(item.id, existing.qty + 1);
    } else {
      write([...lines, { ...item, qty: 1 }]);
    }
  },
  setQty(id: string, qty: number) {
    const next = Math.min(Math.max(Math.floor(qty), 0), MAX_QTY);
    const lines = read();
    write(
      next === 0
        ? lines.filter((l) => l.id !== id)
        : lines.map((l) => (l.id === id ? { ...l, qty: next } : l)),
    );
  },
  /** Replace stored prices/names with fresh server values; drop unavailable items. */
  sync(fresh: Map<string, Omit<CartLine, "qty">>) {
    const lines = read();
    const next = lines
      .filter((l) => fresh.has(l.id))
      .map((l) => ({ ...fresh.get(l.id)!, qty: l.qty }));
    const changed = JSON.stringify(next) !== JSON.stringify(lines);
    if (changed) write(next);
    return changed;
  },
  clear() {
    write([]);
  },
  MAX_QTY,
};
