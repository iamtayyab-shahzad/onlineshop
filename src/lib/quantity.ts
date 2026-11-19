/**
 * Quantity / buy-by-amount maths shared by the browser and the server.
 * The DATABASE (place_order) is the source of truth: it recalculates every
 * line with exact numeric arithmetic. These helpers mirror its rules so the
 * cart shows the same numbers. Money is handled in whole paisa (integers) and
 * quantities in thousandths, so there are no floating-point surprises.
 */

export type PurchaseMethod = "quantity" | "amount" | "both";

export type QtyRule = {
  method: PurchaseMethod;
  min: number;
  max: number;
  step: number;
  decimal: boolean;
  minAmount: number | null;
  maxAmount: number | null;
  unitName: string;
};

export const DEFAULT_RULE: QtyRule = {
  method: "quantity",
  min: 1,
  max: 50,
  step: 1,
  decimal: false,
  minAmount: null,
  maxAmount: null,
  unitName: "",
};

const toPaisa = (rupees: number) => Math.round(rupees * 100);
const toMilli = (qty: number) => Math.round(qty * 1000);

/** Rs amount → quantity, rounded to 3 decimals exactly like the database: round(amount / price, 3). */
export function amountToQty(amount: number, price: number): number {
  const p = toPaisa(price);
  if (p <= 0) return 0;
  return Math.round((toPaisa(amount) * 1000) / p) / 1000;
}

/** Line total in rupees for a quantity line: round(price × qty, 2). */
export function qtyLineTotal(price: number, qty: number): number {
  return Math.round((toPaisa(price) * toMilli(qty)) / 1000) / 100;
}

/** Snap a quantity to the product's step and limits. Returns 0 when below the minimum. */
export function snapQty(qty: number, rule: QtyRule): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const stepM = Math.max(toMilli(rule.step), 1);
  let m = Math.round(toMilli(qty) / stepM) * stepM;
  if (!rule.decimal) m = Math.round(m / 1000) * 1000;
  if (m < toMilli(rule.min) - 0.5) return 0;
  m = Math.min(m, toMilli(rule.max));
  return m / 1000;
}

export function isValidAmount(amount: number, rule: QtyRule): boolean {
  if (!Number.isInteger(amount) || amount <= 0) return false;
  if (rule.method === "quantity" || rule.minAmount == null) return false;
  if (amount < rule.minAmount) return false;
  if (rule.maxAmount != null && amount > rule.maxAmount) return false;
  return true;
}

const qtyFormat = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 3 });

/** 1.5, "kg" → "1.5 kg" */
export function formatQty(qty: number, unitName?: string | null): string {
  const n = qtyFormat.format(qty);
  return unitName ? `${n} ${unitName}` : n;
}
