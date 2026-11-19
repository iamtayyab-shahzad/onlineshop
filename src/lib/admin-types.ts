export type ActionState = { ok?: string; error?: string } | null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/** Read a trimmed text field; empty → null. */
export function text(fd: FormData, name: string, max = 200): string | null {
  const v = String(fd.get(name) ?? "").trim();
  if (!v) return null;
  return v.slice(0, max);
}

/** Read a number field; empty → null; NaN → undefined (invalid). */
export function num(fd: FormData, name: string): number | null | undefined {
  const raw = String(fd.get(name) ?? "").trim().replace(/,/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export const bool = (fd: FormData, name: string) => fd.get(name) === "on" || fd.get(name) === "true";

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
