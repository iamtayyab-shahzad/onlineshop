"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { orderSuggestions, type OrderSuggestion } from "@/app/admin/_actions/orders";
import { ADMIN_STATUS_LABEL } from "@/components/admin/admin-ui";
import { formatPrice } from "@/lib/format";
import { formatDate } from "@/lib/orders";

/**
 * Search box (name, phone or order #) with live suggestions underneath, plus the date filter.
 * It is a normal GET form, so the result page is shareable and works with the back button.
 */
export function OrderSearch({
  q,
  status,
  from,
  to,
}: {
  q: string;
  status: string;
  from: string;
  to: string;
}) {
  const [value, setValue] = useState(q);
  const [items, setItems] = useState<OrderSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function onChange(v: string) {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) {
      latest.current++;
      setItems([]);
      setOpen(false);
      setBusy(false);
      return;
    }
    setBusy(true);
    timer.current = setTimeout(async () => {
      const mine = ++latest.current;
      try {
        const res = await orderSuggestions(v);
        if (mine !== latest.current) return; // an older answer arrived late
        setItems(res);
        setOpen(true);
      } catch {
        if (mine === latest.current) setItems([]);
      } finally {
        if (mine === latest.current) setBusy(false);
      }
    }, 250);
  }

  return (
    <form className="mb-3 flex flex-col gap-2" action="/admin/orders">
      {status !== "all" && <input type="hidden" name="status" value={status} />}
      <div ref={box} className="relative max-w-md">
        <input
          name="q"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => items.length > 0 && setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search customer name, phone or order #"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="order-suggestions"
          aria-autocomplete="list"
          className="h-10 w-full rounded-lg border-2 px-3 text-base outline-none focus-visible:border-primary"
        />
        {open && (
          <div
            id="order-suggestions"
            role="listbox"
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-popover shadow-lg"
          >
            {items.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">{busy ? "Searching…" : "No matching orders."}</p>
            ) : (
              <ul className="max-h-80 divide-y overflow-y-auto">
                {items.map((o) => (
                  <li key={o.id} role="option" aria-selected="false">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{o.delivery_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          #{o.order_number} · {o.delivery_phone} · {formatDate(o.created_at)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums">{formatPrice(o.total)}</span>
                        <span className="block text-xs text-muted-foreground">{ADMIN_STATUS_LABEL[o.status]}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold">
          From date
          <input name="from" type="date" defaultValue={from} className="h-10 rounded-lg border-2 px-2 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          To date <span className="font-normal text-muted-foreground">(optional)</span>
          <input name="to" type="date" defaultValue={to} className="h-10 rounded-lg border-2 px-2 text-base" />
        </label>
        <button className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Search</button>
        {(q || from || to) && (
          <Link
            href={status !== "all" ? `/admin/orders?status=${status}` : "/admin/orders"}
            className="inline-flex h-10 items-center rounded-lg border-2 px-4 text-sm font-semibold"
          >
            Clear
          </Link>
        )}
      </div>
      <p className="text-xs text-muted-foreground">One date shows that day. Fill both to see a range.</p>
    </form>
  );
}
