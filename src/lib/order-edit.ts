/**
 * Shared by the "edit order" and "create order from a voice message" screens.
 * The editor sends its lines as one JSON field; the server re-checks everything and the database checks it again.
 */
export type EditorLine = {
  /** Existing order line (edit mode only). */
  id?: string;
  /** Catalog product for a new line. A line with neither id nor product_id is a custom item. */
  product_id?: string;
  name: string;
  unit_label: string;
  unit_price: number;
  quantity: number;
};

export type EditorPayload = {
  items: EditorLine[];
  discount: number;
  delivery_fee: number | null;
  note: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function lineTotal(price: number, qty: number): number {
  return Math.round(price * qty * 100) / 100;
}

/** Reads the editor's JSON field. Returns an error message (never throws) when something is wrong. */
export function parseEditorPayload(raw: unknown): { ok: EditorPayload } | { error: string } {
  if (typeof raw !== "string" || raw.length > 200_000) return { error: "Invalid request." };
  let p: unknown;
  try {
    p = JSON.parse(raw);
  } catch {
    return { error: "Invalid request." };
  }
  if (!p || typeof p !== "object") return { error: "Invalid request." };
  const o = p as Record<string, unknown>;
  if (!Array.isArray(o.items) || o.items.length === 0) return { error: "Add at least one item." };
  if (o.items.length > 100) return { error: "Too many items (100 is the most)." };

  const items: EditorLine[] = [];
  for (const it of o.items) {
    if (!it || typeof it !== "object") return { error: "Invalid request." };
    const l = it as Record<string, unknown>;
    const price = Number(l.unit_price);
    const qty = Number(l.quantity);
    const name = typeof l.name === "string" ? l.name.trim().slice(0, 120) : "";
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) return { error: `Check the price of "${name || "an item"}".` };
    if (!Number.isFinite(qty) || qty <= 0 || qty > 100_000) return { error: `Check the quantity of "${name || "an item"}".` };
    const id = typeof l.id === "string" && UUID_RE.test(l.id) ? l.id : undefined;
    const product_id = typeof l.product_id === "string" && UUID_RE.test(l.product_id) ? l.product_id : undefined;
    if (!id && !product_id && !name) return { error: "Every extra item needs a name." };
    items.push({
      id,
      product_id,
      name,
      unit_label: typeof l.unit_label === "string" ? l.unit_label.trim().slice(0, 40) : "",
      unit_price: price,
      quantity: qty,
    });
  }

  const discount = o.discount === null || o.discount === "" || o.discount === undefined ? 0 : Number(o.discount);
  if (!Number.isFinite(discount) || discount < 0) return { error: "The discount must be zero or more." };
  let fee: number | null = null;
  if (o.delivery_fee !== null && o.delivery_fee !== undefined && o.delivery_fee !== "") {
    fee = Number(o.delivery_fee);
    if (!Number.isFinite(fee) || fee < 0 || fee > 100_000) return { error: "Check the delivery fee." };
  }
  const note = typeof o.note === "string" && o.note.trim() ? o.note.trim().slice(0, 500) : null;
  return { ok: { items, discount, delivery_fee: fee, note } };
}

/** The lines as the database function wants them (only what it needs for each kind of line). */
export function toRpcItems(items: EditorLine[]) {
  return items.map((l) =>
    l.id
      ? { id: l.id, unit_price: l.unit_price, quantity: l.quantity }
      : l.product_id
        ? { product_id: l.product_id, unit_price: l.unit_price, quantity: l.quantity }
        : { name: l.name, unit_label: l.unit_label || "each", unit_price: l.unit_price, quantity: l.quantity },
  );
}

const ERRORS: Record<string, string> = {
  not_admin: "You are not allowed to do this.",
  order_not_found: "This order was not found.",
  voice_order_not_found: "This voice message was not found.",
  empty_items: "Add at least one item.",
  too_many_items: "Too many items (100 is the most).",
  invalid_price: "One of the prices is not valid.",
  invalid_quantity: "One of the quantities is not valid.",
  invalid_name: "Every extra item needs a name.",
  invalid_fee: "Check the delivery fee.",
  invalid_discount: "The discount must be zero or more.",
  discount_too_big: "The discount is more than the whole bill.",
  item_not_found: "An item on this order changed. Reload the page and try again.",
  item_unavailable: "A product you added is no longer available.",
  note_too_long: "The note is too long.",
};

/** Turns a database error into a sentence the shop owner can act on. */
export function orderErrorMessage(message: string | undefined): string {
  const key = Object.keys(ERRORS).find((k) => message?.includes(k));
  return key ? ERRORS[key] : "Could not save. Please try again.";
}
