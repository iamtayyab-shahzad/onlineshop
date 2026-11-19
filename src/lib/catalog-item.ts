import type { Product } from "@/lib/catalog";
import type { CartItem } from "@/lib/cart-store";
import type { QtyRule } from "@/lib/quantity";

/** Public product fields → the rules the cart needs. No internal prices here. */
export function ruleFor(p: Product): QtyRule {
  return {
    method: p.purchase_method,
    min: Number(p.min_qty),
    max: Number(p.max_qty),
    step: Number(p.qty_step),
    decimal: p.unit?.allow_decimal ?? false,
    minAmount: p.min_amount == null ? null : Number(p.min_amount),
    maxAmount: p.max_amount == null ? null : Number(p.max_amount),
    unitName: p.unit?.name ?? "",
  };
}

export function toCartItem(p: Product): CartItem {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    unit: p.unit_label,
    price: Number(p.selling_price),
    icon: p.category?.icon ?? null,
    image: p.image_url,
    rule: ruleFor(p),
  };
}
