"use server";

import { refresh, updateTag } from "next/cache";
import { adminDb } from "@/lib/auth";
import { isUuid, type ActionState } from "@/lib/admin-types";

const BUCKET = "product-images";
const PATH_RE = /^library\/[0-9a-f]{64}\.webp$/;

export type UploadedImage = {
  path: string;
  sha256: string;
  original_name: string;
  width: number;
  height: number;
};

/**
 * Called after the browser has uploaded files straight to Storage (as the
 * admin). Records them in the library; the same photo (same SHA-256) is only
 * kept once. Optionally attaches them to a product.
 */
export async function registerImages(
  files: UploadedImage[],
  productId?: string,
): Promise<{ added: number; duplicates: number; sharedWith?: string[]; error?: string }> {
  const { supabase } = await adminDb();
  if (!Array.isArray(files) || files.length > 200) return { added: 0, duplicates: 0, error: "Too many files." };
  if (productId !== undefined && !isUuid(productId)) return { added: 0, duplicates: 0, error: "Invalid product." };
  const rows = files
    .filter((f) => PATH_RE.test(f.path) && f.path === `library/${f.sha256}.webp`)
    .map((f) => ({
      path: f.path,
      sha256: f.sha256,
      original_name: String(f.original_name).slice(0, 200),
      width: Math.trunc(f.width) || null,
      height: Math.trunc(f.height) || null,
      product_id: productId ?? null,
    }));
  const { data, error } = await supabase
    .from("product_images")
    .upsert(rows, { onConflict: "sha256", ignoreDuplicates: true })
    .select("id");
  if (error) return { added: 0, duplicates: 0, error: "Could not save the images." };
  let sharedWith: string[] | undefined;
  if (productId && rows.length) {
    const hashes = rows.map((r) => r.sha256);
    // Existing duplicates: attach them to this product too if they were unassigned.
    await supabase.from("product_images").update({ product_id: productId }).in("sha256", hashes).is("product_id", null);

    // A photo already in the library for ANOTHER product stays in that product's list (a photo is stored
    // once), but this product shows it as its main photo, which is what uploading it here means.
    const { data: lib } = await supabase.from("product_images").select("sha256, path, product_id").in("sha256", hashes);
    const others = (lib ?? []).filter((r) => r.product_id && r.product_id !== productId);
    if (others.length) {
      const first = hashes.map((h) => others.find((o) => o.sha256 === h)).find(Boolean)!;
      await setProductImage(productId, supabase.storage.from(BUCKET).getPublicUrl(first.path).data.publicUrl);
      const { data: owners } = await supabase
        .from("products")
        .select("name, unit_label")
        .in("id", [...new Set(others.map((o) => o.product_id!))]);
      sharedWith = (owners ?? []).map((o) => `${o.name} (${o.unit_label})`);
    }
    await ensureMainImage(productId);
  }
  updateTag("catalog");
  refresh();
  return { added: data?.length ?? 0, duplicates: rows.length - (data?.length ?? 0), sharedWith };
}

/** Takes the main photo off a product (e.g. a photo shared from another product). Its own first photo, if any, takes over. */
export async function removeMainPhoto(_p: ActionState, fd: FormData): Promise<ActionState> {
  const id = fd.get("product_id");
  if (!isUuid(id)) return { error: "Invalid request." };
  const error = await setProductImage(id, null);
  if (error) return { error: "Could not save." };
  await ensureMainImage(id);
  updateTag("catalog");
  refresh();
  return { ok: "Photo removed from this product." };
}

/**
 * Sets a product's main photo. For a main product, its sizes that still show the old main photo
 * (or none) follow along; sizes with their own photo keep it.
 */
async function setProductImage(productId: string, url: string | null) {
  const { supabase } = await adminDb();
  const { data: p } = await supabase.from("products").select("image_url, variant_of").eq("id", productId).single();
  const { error } = await supabase.from("products").update({ image_url: url }).eq("id", productId);
  if (error) return error;
  if (p && !p.variant_of) {
    const sizes = () => supabase.from("products").update({ image_url: url }).eq("variant_of", productId);
    await sizes().is("image_url", null);
    if (p.image_url && p.image_url !== url) await sizes().eq("image_url", p.image_url);
  }
  return null;
}

/**
 * If a product has no photo of its own yet, use its first image.
 * A size that is still showing its main product's photo counts as "no photo of its own".
 */
async function ensureMainImage(productId: string) {
  const { supabase } = await adminDb();
  const { data: p } = await supabase.from("products").select("image_url, variant_of").eq("id", productId).single();
  if (p?.image_url) {
    if (!p.variant_of) return;
    const { data: main } = await supabase.from("products").select("image_url").eq("id", p.variant_of).maybeSingle();
    if (p.image_url !== main?.image_url) return; // the size already has its own photo
  }
  const { data: img } = await supabase
    .from("product_images")
    .select("path")
    .eq("product_id", productId)
    .order("sort_order")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!img) return;
  await setProductImage(productId, supabase.storage.from(BUCKET).getPublicUrl(img.path).data.publicUrl);
}

/** Assign (or unassign with an empty product) one image. */
export async function assignImage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const id = fd.get("image_id");
  const productId = fd.get("product_id");
  if (!isUuid(id) || (productId && !isUuid(productId))) return { error: "Choose a product." };
  const { data: before } = await supabase.from("product_images").select("product_id").eq("id", id).maybeSingle();
  const { data: img, error } = await supabase
    .from("product_images")
    .update({ product_id: (productId as string) || null })
    .eq("id", id)
    .select("path")
    .single();
  if (error || !img) return { error: "Could not save." };
  if (!productId) {
    // Only the product it was taken from loses it as main photo; other products sharing it keep it.
    const oldId = before?.product_id;
    if (oldId) {
      const url = supabase.storage.from(BUCKET).getPublicUrl(img.path).data.publicUrl;
      const { data: old } = await supabase.from("products").select("image_url").eq("id", oldId).maybeSingle();
      if (old?.image_url === url) {
        await setProductImage(oldId, null);
        await ensureMainImage(oldId);
      }
    }
  } else await ensureMainImage(productId as string);
  updateTag("catalog");
  refresh();
  return { ok: productId ? "Assigned." : "Removed from product." };
}

/** Confirm several suggested matches at once (`pair` = imageId:productId). */
export async function confirmMatches(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const pairs = fd
    .getAll("pair")
    .map((v) => String(v).split(":"))
    .filter(([i, p]) => isUuid(i) && isUuid(p))
    .slice(0, 200);
  if (!pairs.length) return { error: "Nothing selected." };
  for (const [imageId, productId] of pairs) {
    await supabase.from("product_images").update({ product_id: productId }).eq("id", imageId).is("product_id", null);
  }
  for (const productId of new Set(pairs.map(([, p]) => p))) await ensureMainImage(productId);
  updateTag("catalog");
  refresh();
  return { ok: `${pairs.length} image(s) assigned.` };
}

export async function setMainImage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const id = fd.get("image_id");
  if (!isUuid(id)) return { error: "Invalid request." };
  const { data: img } = await supabase.from("product_images").select("path, product_id").eq("id", id).single();
  if (!img?.product_id) return { error: "Assign the image to a product first." };
  const error = await setProductImage(img.product_id, supabase.storage.from(BUCKET).getPublicUrl(img.path).data.publicUrl);
  if (error) return { error: "Could not save." };
  updateTag("catalog");
  refresh();
  return { ok: "Main photo set." };
}

/** A size goes back to showing its main product's photo (its own photos stay in its list). */
export async function revertToMainPhoto(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const id = fd.get("product_id");
  if (!isUuid(id)) return { error: "Invalid request." };
  const { data: p } = await supabase.from("products").select("variant_of").eq("id", id).single();
  if (!p?.variant_of) return { error: "This is not a size of another product." };
  const { data: main } = await supabase.from("products").select("image_url").eq("id", p.variant_of).single();
  const { error } = await supabase.from("products").update({ image_url: main?.image_url ?? null }).eq("id", id);
  if (error) return { error: "Could not save." };
  updateTag("catalog");
  refresh();
  return { ok: "Now using the main product’s photo." };
}

/** Removes the file and its library entry. Products using it as main photo fall back to the neutral placeholder. */
export async function deleteImage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const id = fd.get("image_id");
  if (!isUuid(id)) return { error: "Invalid request." };
  const { data: img } = await supabase.from("product_images").select("path").eq("id", id).single();
  if (!img) return { error: "Image not found." };
  await clearMainIfUsing(img.path);
  const { error } = await supabase.storage.from(BUCKET).remove([img.path]);
  if (error) return { error: "Could not delete the file." };
  await supabase.from("product_images").delete().eq("id", id);
  updateTag("catalog");
  refresh();
  return { ok: "Deleted." };
}

async function clearMainIfUsing(path: string) {
  const { supabase } = await adminDb();
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  await supabase.from("products").update({ image_url: null }).eq("image_url", url);
}
