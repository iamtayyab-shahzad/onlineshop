"use server";

import { getProductsByIds } from "@/lib/catalog";

export type FreshCartItem = {
  id: string;
  slug: string;
  name: string;
  unit: string;
  price: number;
  icon: string | null;
};

/**
 * Returns the CURRENT public price and name for products in the cart.
 * Inactive or deleted products are simply missing from the result.
 * Only public fields are returned — never supplier prices.
 */
export async function refreshCartItems(ids: unknown): Promise<FreshCartItem[]> {
  if (!Array.isArray(ids)) return [];
  const products = await getProductsByIds(ids.filter((id): id is string => typeof id === "string"));
  return products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    unit: p.unit_label,
    price: p.selling_price,
    icon: p.category?.icon ?? null,
  }));
}
