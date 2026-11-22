"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { adminDb } from "@/lib/auth";
import { bool, isUuid, num, slugify, text, type ActionState } from "@/lib/admin-types";
import type { Database } from "@/lib/database.types";

type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type Method = Database["public"]["Enums"]["purchase_method"];

const done = (ok: string): ActionState => {
  updateTag("catalog");
  refresh();
  return { ok };
};

const FK_IN_USE = "23503";
const UNIQUE = "23505";
const CHECK = "23514";

/* ------------------------------- Products -------------------------------- */

export async function saveProduct(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const id = fd.get("id");
  const name = text(fd, "name", 120);
  const category_id = fd.get("category_id");
  const unit_id = fd.get("unit_id");
  if (!name) return { error: "Please enter the product name." };
  if (!isUuid(category_id) || !isUuid(unit_id)) return { error: "Please choose a category and a unit." };

  const selling = num(fd, "selling_price");
  const supplier = num(fd, "supplier_price");
  if (selling == null || selling < 0 || selling > 1_000_000) return { error: "Please enter a valid selling price." };
  if (supplier === undefined || (supplier != null && (supplier < 0 || supplier > 1_000_000))) {
    return { error: "Supplier price is not valid." };
  }

  const method = (fd.get("purchase_method") as Method) || "quantity";
  if (!["quantity", "amount", "both"].includes(method)) return { error: "Invalid buying method." };
  const min_qty = num(fd, "min_qty") ?? 1;
  const max_qty = num(fd, "max_qty") ?? 50;
  const qty_step = num(fd, "qty_step") ?? 1;
  const min_amount = num(fd, "min_amount");
  const max_amount = num(fd, "max_amount");
  if ([min_qty, max_qty, qty_step, min_amount, max_amount].some((v) => v === undefined)) {
    return { error: "One of the numbers is not valid." };
  }
  if (min_qty! <= 0 || qty_step! <= 0 || max_qty! < min_qty!) {
    return { error: "Check min / max quantity and step (max must be at least min)." };
  }
  if (method !== "quantity" && !min_amount) return { error: "Buying by amount needs a minimum amount (e.g. Rs 50)." };

  // Decimal quantities only if the chosen unit allows them (e.g. kg yes, packet no).
  const { data: unit } = await supabase.from("units").select("name, allow_decimal").eq("id", unit_id).maybeSingle();
  if (!unit) return { error: "Unit not found." };
  const isWhole = (v: number) => Number.isInteger(v);
  if (!unit.allow_decimal && (!isWhole(min_qty!) || !isWhole(max_qty!) || !isWhole(qty_step!))) {
    return { error: `“${unit.name}” is counted in whole numbers. Use whole min / max / step, or pick another unit.` };
  }

  // A size of another product ("Size of" on the form). Empty = a normal product.
  const rawParent = fd.get("variant_of");
  const variantOf = typeof rawParent === "string" && rawParent !== "" ? rawParent : null;
  if (variantOf && !isUuid(variantOf)) return { error: "Please choose the main product again." };
  if (variantOf && variantOf === id) return { error: "A product cannot be a size of itself." };
  const unitLabel = text(fd, "unit_label", 40) ?? unit.name;
  if (variantOf && !text(fd, "unit_label", 40)) return { error: "Please enter the size name, e.g. 500 g." };

  const row: ProductInsert = {
    name,
    name_urdu: text(fd, "name_urdu", 120),
    slug: slugify(text(fd, "slug", 60) ?? (variantOf ? `${name} ${unitLabel}` : name)) || `item-${Date.now()}`,
    variant_of: variantOf,
    category_id,
    unit_id,
    unit_label: unitLabel,
    description: text(fd, "description", 1000),
    selling_price: selling,
    purchase_method: method,
    min_qty: min_qty!,
    max_qty: max_qty!,
    qty_step: qty_step!,
    min_amount: min_amount ?? null,
    max_amount: max_amount ?? null,
    in_stock: bool(fd, "in_stock"),
    is_active: bool(fd, "is_active"),
    is_featured: bool(fd, "is_featured"),
    sort_order: Math.trunc(num(fd, "sort_order") ?? 0),
  };

  // A new size starts with the main product’s photo (change it on the size’s page if needed).
  if (variantOf && !isUuid(id)) {
    const { data: parent } = await supabase.from("products").select("image_url").eq("id", variantOf).maybeSingle();
    row.image_url = parent?.image_url ?? null;
  }

  const res = isUuid(id)
    ? await supabase.from("products").update(row).eq("id", id).select("id").single()
    : await supabase.from("products").insert(row).select("id").single();
  if (res.error) {
    if (res.error.message.includes("variant_of_variant")) {
      return { error: "That product is itself a size. Choose the main product instead." };
    }
    if (res.error.message.includes("has_variants")) {
      return { error: "This product already has sizes of its own, so it cannot become a size of another product." };
    }
    if (res.error.code === UNIQUE) return { error: "Another product already uses this web name (slug). Change it." };
    if (res.error.code === CHECK) return { error: "Some values are not allowed. Check prices, min / max and amounts." };
    return { error: "Could not save the product. Please try again." };
  }
  const productId = res.data.id;

  // Supplier price lives in an admin-only table so it can never reach customers.
  if (supplier == null) await supabase.from("product_costs").delete().eq("product_id", productId);
  else await supabase.from("product_costs").upsert({ product_id: productId, supplier_price: supplier });

  updateTag("catalog");
  if (!isUuid(id)) redirect(`/admin/products/${productId}?created=1`);
  refresh();
  return { ok: "Saved." };
}

/** Deleting keeps old orders intact: order lines keep their own copy of name, unit and price. */
export async function deleteProduct(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const id = fd.get("id");
  if (!isUuid(id)) return { error: "Invalid request." };
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { error: "Could not delete. You can untick “Show in shop” instead." };
  updateTag("catalog");
  redirect("/admin/products");
}

export async function quickProductUpdate(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const id = fd.get("id");
  const price = num(fd, "selling_price");
  if (!isUuid(id) || price == null || price < 0) return { error: "Invalid price." };
  const { error } = await supabase
    .from("products")
    .update({ selling_price: price, in_stock: bool(fd, "in_stock") })
    .eq("id", id);
  if (error) return { error: "Could not save." };
  return done("Saved");
}

/* ------------------------------ Categories ------------------------------- */

export async function saveCategory(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const id = fd.get("id");
  const name = text(fd, "name", 60);
  if (!name) return { error: "Please enter a name." };
  const row = {
    name,
    name_urdu: text(fd, "name_urdu", 60),
    slug: slugify(text(fd, "slug", 60) ?? name) || `cat-${Date.now()}`,
    icon: text(fd, "icon", 8),
    sort_order: Math.trunc(num(fd, "sort_order") ?? 0),
    is_active: bool(fd, "is_active"),
  };
  const { error } = isUuid(id)
    ? await supabase.from("categories").update(row).eq("id", id)
    : await supabase.from("categories").insert(row);
  if (error) return { error: error.code === UNIQUE ? "This web name (slug) is already used." : "Could not save." };
  return done(isUuid(id) ? "Saved." : "Category added.");
}

export async function deleteCategory(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const id = fd.get("id");
  if (!isUuid(id)) return { error: "Invalid request." };
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    return {
      error:
        error.code === FK_IN_USE
          ? "This category still has products. Move or delete them first, or hide the category."
          : "Could not delete.",
    };
  }
  return done("Deleted.");
}

/* --------------------------------- Units --------------------------------- */

export async function saveUnit(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const id = fd.get("id");
  const name = text(fd, "name", 30);
  if (!name) return { error: "Please enter a unit name, e.g. kg." };
  const code = (text(fd, "code", 20) ?? name).toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 20);
  const row = {
    name,
    code,
    allow_decimal: bool(fd, "allow_decimal"),
    is_active: bool(fd, "is_active"),
    sort_order: Math.trunc(num(fd, "sort_order") ?? 0),
  };
  const { error } = isUuid(id)
    ? await supabase.from("units").update(row).eq("id", id)
    : await supabase.from("units").insert(row);
  if (error) return { error: error.code === UNIQUE ? "A unit with this code already exists." : "Could not save." };
  return done(isUuid(id) ? "Saved." : "Unit added.");
}

export async function deleteUnit(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const id = fd.get("id");
  if (!isUuid(id)) return { error: "Invalid request." };
  const { error } = await supabase.from("units").delete().eq("id", id);
  if (error) {
    return {
      error: error.code === FK_IN_USE ? "Some products use this unit. Change them first, or hide the unit." : "Could not delete.",
    };
  }
  return done("Deleted.");
}
