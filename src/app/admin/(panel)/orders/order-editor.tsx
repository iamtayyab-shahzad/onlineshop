"use client";

import { useEffect, useRef, useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { inputCls } from "@/components/admin/admin-ui";
import { searchProducts, type ProductHit } from "@/app/admin/_actions/order-edit";
import { formatPrice } from "@/lib/format";
import { lineTotal, type EditorLine } from "@/lib/order-edit";
import { PAYMENT_LABEL, PAYMENT_METHODS } from "@/lib/orders";
import type { ActionState } from "@/lib/admin-types";

type Line = {
  key: string;
  id?: string;
  product_id?: string;
  name: string;
  unit_label: string;
  price: string;
  qty: string;
  custom?: boolean;
};

const num = (v: string) => {
  const n = Number(v.trim().replace(/,/g, ""));
  return v.trim() !== "" && Number.isFinite(n) ? n : NaN;
};

let counter = 0;
const nextKey = () => `l${++counter}`;

/**
 * Order lines editor, used both to edit an existing order and to create an order from a voice message.
 * Change quantity or price, remove a line, add a shop product or a one-off item, give a discount.
 * Totals update as you type; nothing is saved until the button at the bottom is pressed.
 */
export function OrderEditor({
  action,
  hidden,
  submit,
  initialItems,
  initialDiscount,
  initialFee,
  initialNote,
  noteLabel = "Note on the order history (optional)",
  paymentChoice,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  submit: string;
  initialItems: EditorLine[];
  initialDiscount: number;
  initialFee: number;
  initialNote: string;
  noteLabel?: string;
  /** Show a "how will they pay" choice (used when creating an order). */
  paymentChoice?: boolean;
}) {
  const [lines, setLines] = useState<Line[]>(() =>
    initialItems.map((l) => ({
      key: nextKey(),
      id: l.id,
      product_id: l.product_id,
      name: l.name,
      unit_label: l.unit_label,
      price: String(l.unit_price),
      qty: String(l.quantity),
    })),
  );
  const [discount, setDiscount] = useState(initialDiscount ? String(initialDiscount) : "");
  const [fee, setFee] = useState(String(initialFee));
  const [note, setNote] = useState(initialNote);

  const patch = (key: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const remove = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));
  const addProduct = (p: ProductHit) =>
    setLines((ls) => [
      ...ls,
      { key: nextKey(), product_id: p.id, name: p.name, unit_label: p.unit_label, price: String(p.selling_price), qty: "1" },
    ]);
  const addCustom = () =>
    setLines((ls) => [...ls, { key: nextKey(), name: "", unit_label: "each", price: "", qty: "1", custom: true }]);

  const subtotal = lines.reduce((s, l) => {
    const t = lineTotal(num(l.price) || 0, num(l.qty) || 0);
    return s + t;
  }, 0);
  const feeN = num(fee);
  const discN = discount.trim() === "" ? 0 : num(discount);
  const bad = lines.some((l) => !(num(l.price) >= 0) || !(num(l.qty) > 0) || (!l.id && !l.product_id && !l.name.trim()));
  const total = subtotal + (feeN || 0) - (discN || 0);
  const discountTooBig = (discN || 0) > subtotal + (feeN || 0);

  const payload = JSON.stringify({
    items: lines.map((l) => ({
      id: l.id,
      product_id: l.product_id,
      name: l.name,
      unit_label: l.unit_label,
      unit_price: num(l.price),
      quantity: num(l.qty),
    })),
    discount: discN,
    delivery_fee: Number.isNaN(feeN) ? null : feeN,
    note: note.trim() || null,
  });

  return (
    <ActionForm action={action} submit={submit} className="gap-4">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="payload" value={payload} />

      <ul className="flex flex-col gap-2">
        {lines.map((l) => (
          <li key={l.key} className="rounded-xl border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              {l.custom ? (
                <input
                  value={l.name}
                  onChange={(e) => patch(l.key, { name: e.target.value })}
                  placeholder="Item name"
                  maxLength={120}
                  aria-label="Item name"
                  className={inputCls}
                />
              ) : (
                <p className="font-semibold">{l.name}</p>
              )}
              <button
                type="button"
                onClick={() => remove(l.key)}
                className="h-9 shrink-0 rounded-lg border-2 border-destructive px-3 text-sm font-semibold text-destructive"
              >
                Remove
              </button>
            </div>
            <div className="mt-2 grid grid-cols-3 items-end gap-2">
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Qty{l.custom ? "" : ` (${l.unit_label})`}
                <input
                  value={l.qty}
                  onChange={(e) => patch(l.key, { qty: e.target.value })}
                  inputMode="decimal"
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Price (Rs)
                <input
                  value={l.price}
                  onChange={(e) => patch(l.key, { price: e.target.value })}
                  inputMode="decimal"
                  placeholder="0"
                  className={inputCls}
                />
              </label>
              <p className="pb-2 text-right text-sm font-bold tabular-nums">
                {formatPrice(lineTotal(num(l.price) || 0, num(l.qty) || 0))}
              </p>
            </div>
            {l.custom && (
              <label className="mt-2 flex flex-col gap-1 text-xs font-semibold">
                Unit (kg, dozen, packet…)
                <input
                  value={l.unit_label}
                  onChange={(e) => patch(l.key, { unit_label: e.target.value })}
                  maxLength={40}
                  className={inputCls + " max-w-40"}
                />
              </label>
            )}
          </li>
        ))}
        {lines.length === 0 && <li className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No items yet. Add one below.</li>}
      </ul>

      <div className="rounded-xl border bg-muted/40 p-3">
        <p className="mb-2 text-sm font-semibold">Add an item</p>
        <ProductPicker onPick={addProduct} />
        <button type="button" onClick={addCustom} className="mt-2 h-9 rounded-lg border-2 px-3 text-sm font-semibold">
          + Add an item that is not in the shop
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Delivery fee (Rs)
          <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Extra discount (Rs)
          <input
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className={inputCls}
          />
        </label>
      </div>
      {paymentChoice && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          How will the customer pay?
          <select name="payment_method" defaultValue="cod" className={inputCls}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {noteLabel}
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputCls} />
      </label>

      <dl className="grid grid-cols-2 gap-1 rounded-xl border bg-card p-3 text-sm">
        <dt>Items</dt>
        <dd className="text-right tabular-nums">{formatPrice(subtotal)}</dd>
        <dt>Delivery</dt>
        <dd className="text-right tabular-nums">{formatPrice(feeN || 0)}</dd>
        {(discN || 0) > 0 && (
          <>
            <dt>Discount</dt>
            <dd className="text-right tabular-nums">− {formatPrice(discN || 0)}</dd>
          </>
        )}
        <dt className="text-base font-bold">Customer pays</dt>
        <dd className="text-right text-base font-bold tabular-nums">{formatPrice(Math.max(0, total))}</dd>
      </dl>
      {(bad || Number.isNaN(feeN) || Number.isNaN(discN) || discountTooBig) && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {discountTooBig
            ? "The discount is more than the whole bill."
            : "Check the numbers: every item needs a quantity above 0 and a price (0 or more). Custom items also need a name."}
        </p>
      )}
    </ActionForm>
  );
}

/** Type a product name, pick it from the list. */
function ProductPicker({ onPick }: { onPick: (p: ProductHit) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
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
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (!v.trim()) {
      latest.current++;
      setHits([]);
      setOpen(false);
      setBusy(false);
      return;
    }
    setBusy(true);
    timer.current = setTimeout(async () => {
      const mine = ++latest.current;
      try {
        const res = await searchProducts(v);
        if (mine !== latest.current) return;
        setHits(res);
        setOpen(true);
      } catch {
        if (mine === latest.current) setHits([]);
      } finally {
        if (mine === latest.current) setBusy(false);
      }
    }, 250);
  }

  return (
    <div ref={box} className="relative">
      <input
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter") e.preventDefault(); // Enter must not save the whole order
        }}
        placeholder="Search a product by name"
        autoComplete="off"
        className={inputCls}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-popover shadow-lg">
          {hits.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{busy ? "Searching…" : "No product found."}</p>
          ) : (
            <ul className="max-h-72 divide-y overflow-y-auto">
              {hits.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(p);
                      setQ("");
                      setHits([]);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {formatPrice(p.selling_price)} / {p.unit_label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
