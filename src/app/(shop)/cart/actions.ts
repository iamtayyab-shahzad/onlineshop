"use server";

import { getProductsByIds } from "@/lib/catalog";
import { toCartItem } from "@/lib/catalog-item";
import type { CartItem } from "@/lib/cart-store";

export type FreshCartItem = CartItem;

/**
 * Returns the CURRENT public price, name and buying rules for products in the
 * cart. Inactive, deleted or out-of-stock products are simply missing.
 * Only public fields are returned — never supplier prices.
 */
export async function refreshCartItems(ids: unknown): Promise<FreshCartItem[]> {
  if (!Array.isArray(ids)) return [];
  const products = await getProductsByIds(ids.filter((id): id is string => typeof id === "string"));
  return products.filter((p) => p.in_stock && p.selling_price > 0).map(toCartItem);
}
