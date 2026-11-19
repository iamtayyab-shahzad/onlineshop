import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Customer-facing catalog data.
 *
 * SECURITY: every query here selects an explicit list of PUBLIC columns.
 * Supplier prices live in the admin-only `product_costs` table and are never
 * selected here. Do not add `*` selects or joins to cost tables in this file.
 *
 * Results are cached and tagged "catalog"; admin edits call
 * updateTag("catalog") so customers see new prices straight away.
 */

export type Category = {
  id: string;
  name: string;
  name_urdu: string | null;
  slug: string;
  icon: string | null;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  name_urdu: string | null;
  unit_label: string;
  description: string | null;
  image_url: string | null;
  selling_price: number;
  purchase_method: "quantity" | "amount" | "both";
  min_qty: number;
  max_qty: number;
  qty_step: number;
  min_amount: number | null;
  max_amount: number | null;
  in_stock: boolean;
  category: { slug: string; name: string; icon: string | null } | null;
  unit: { name: string; allow_decimal: boolean } | null;
};

export type StoreSettings = {
  store_name: string;
  delivery_fee: number;
  min_order_amount: number;
  support_phone: string | null;
  support_whatsapp: string | null;
  delivery_areas: string | null;
  delivery_hours: string | null;
};

const CATEGORY_COLUMNS = "id, name, name_urdu, slug, icon";
const PRODUCT_COLUMNS =
  "id, slug, name, name_urdu, unit_label, description, image_url, selling_price, purchase_method, min_qty, max_qty, qty_step, min_amount, max_amount, in_stock, category:categories(slug, name, icon), unit:units(name, allow_decimal)";

function fail(context: string, message: string): never {
  throw new Error(`Could not load ${context}: ${message}`);
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { data, error } = await createPublicClient()
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .eq("is_active", true)
    .order("sort_order");
  if (error) fail("categories", error.message);
  return data;
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { data, error } = await createPublicClient()
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) fail("category", error.message);
  return data;
}

export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { data, error } = await createPublicClient()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) fail("products", error.message);
  return data;
}

export async function getFeaturedProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { data, error } = await createPublicClient()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("sort_order")
    .limit(12);
  if (error) fail("popular products", error.message);
  return data;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { data, error } = await createPublicClient()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) fail("product", error.message);
  return data;
}

/** Slugs for prerendering product pages at build time. */
export async function getAllProductSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { data, error } = await createPublicClient()
    .from("products")
    .select("slug")
    .eq("is_active", true);
  if (error) fail("product list", error.message);
  return data.map((p) => p.slug);
}

/**
 * Turn free text into safe search words. Only letters (any script, so Urdu
 * works), digits and spaces survive; this prevents breaking out of the
 * PostgREST filter syntax (commas, parentheses, dots, wildcards).
 */
export function toSearchWords(query: string): string[] {
  return query
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 5)
    .map((w) => w.slice(0, 30));
}

export async function searchProducts(query: string): Promise<Product[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const words = toSearchWords(query);
  if (words.length === 0) return [];

  let request = createPublicClient()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("is_active", true);
  // Every word must match the English or Urdu name (AND across words).
  for (const w of words) {
    request = request.or(`name.ilike.%${w}%,name_urdu.ilike.%${w}%`);
  }
  const { data, error } = await request.order("name").limit(50);
  if (error) fail("search results", error.message);
  return data;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Current public details for the products in a cart (max 100 ids). */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const clean = [...new Set(ids)].filter((id) => UUID.test(id)).slice(0, 100);
  if (clean.length === 0) return [];
  const { data, error } = await createPublicClient()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .in("id", clean)
    .eq("is_active", true);
  if (error) fail("cart products", error.message);
  return data;
}

export async function getStoreSettings(): Promise<StoreSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { data, error } = await createPublicClient()
    .from("store_settings")
    .select(
      "store_name, delivery_fee, min_order_amount, support_phone, support_whatsapp, delivery_areas, delivery_hours",
    )
    .single();
  if (error) fail("store settings", error.message);
  return data;
}

export type PaymentDetails = {
  jazzcash_number: string | null;
  jazzcash_account_name: string | null;
  bank_name: string | null;
  bank_account_title: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
  easypaisa_number: string | null;
  easypaisa_account_name: string | null;
  jazzcash_qr_url: string | null;
  easypaisa_qr_url: string | null;
  bank_qr_url: string | null;
};

/** The shop's own JazzCash / Easypaisa / bank details (and QR codes) that customers send money TO. */
export async function getPaymentDetails(): Promise<PaymentDetails> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { data, error } = await createPublicClient()
    .from("store_settings")
    .select(
      "jazzcash_number, jazzcash_account_name, bank_name, bank_account_title, bank_account_number, bank_iban, easypaisa_number, easypaisa_account_name, jazzcash_qr_url, easypaisa_qr_url, bank_qr_url",
    )
    .single();
  if (error) fail("payment details", error.message);
  return data;
}

type Method = "cod" | "jazzcash" | "easypaisa" | "bank_transfer";

/** COD always; online methods only once the shop has entered its account details (place_order checks this too). */
export function availablePaymentMethods(pay: PaymentDetails): Method[] {
  const methods: Method[] = ["cod"];
  if (pay.jazzcash_number) methods.push("jazzcash");
  if (pay.easypaisa_number) methods.push("easypaisa");
  if (pay.bank_account_number || pay.bank_iban) methods.push("bank_transfer");
  return methods;
}
