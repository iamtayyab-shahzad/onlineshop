/**
 * Order search helpers (admin). The typed text is cleaned first because it ends up inside a
 * PostgREST `or(...)` filter, where commas, brackets and wildcard characters have a meaning.
 */
export function cleanSearch(q: string | null | undefined): string {
  return (q ?? "")
    .replace(/[%*_,()"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/** Filter that matches the customer name, the phone number, or the order number. Null when nothing was typed. */
export function orderSearchFilter(q: string | null | undefined): string | null {
  const s = cleanSearch(q);
  if (!s) return null;
  const parts = [`delivery_name.ilike.*${s}*`];
  const digits = s.replace(/\D/g, "");
  if (/^#?\s?\d{1,9}$/.test(s)) parts.push(`order_number.eq.${Number(digits)}`);
  if (digits.length >= 3) parts.push(`delivery_phone.ilike.*${digits}*`);
  return parts.join(",");
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function validDay(v: string | null | undefined): v is string {
  return !!v && DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

/**
 * One date or a range, as the exact moments to filter on (Pakistan time, so "today" means the shop's today).
 * Only "from" filled = that single day. Only "to" filled = that single day. If the dates are the wrong way round they are swapped.
 */
export function dayRange(from?: string | null, to?: string | null): { from: string; to: string; gte: string; lt: string } | null {
  let a = validDay(from) ? from : null;
  let b = validDay(to) ? to : null;
  if (!a && !b) return null;
  a ??= b;
  b ??= a;
  if (a! > b!) [a, b] = [b, a];
  const start = new Date(`${a}T00:00:00+05:00`);
  const end = new Date(new Date(`${b}T00:00:00+05:00`).getTime() + 86_400_000);
  return { from: a!, to: b!, gte: start.toISOString(), lt: end.toISOString() };
}
