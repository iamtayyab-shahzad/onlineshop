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
): Promise<{ added: number; duplicates: number; error?: string }> {
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
  if (productId) {
    // Existing duplicates: attach them to this product too if they were unassigned.
    await supabase
      .from("product_images")
      .update({ product_id: productId })
      .in("sha256", rows.map((r) => r.sha256))
      .is("product_id", null);
    await ensureMainImage(productId);
  }
  updateTag("catalog");
  refresh();
  return { added: data?.length ?? 0, duplicates: rows.length - (data?.length ?? 0) };
}

/** If a product has no main photo yet, use its first image. */
async function ensureMainImage(productId: string) {
  const { supabase } = await adminDb();
  const { data: p } = await supabase.from("products").select("image_url").eq("id", productId).single();
  if (p?.image_url) return;
  const { data: img } = await supabase
    .from("product_images")
    .select("path")
    .eq("product_id", productId)
    .order("sort_order")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!img) return;
  const url = supabase.storage.from(BUCKET).getPublicUrl(img.path).data.publicUrl;
  await supabase.from("products").update({ image_url: url }).eq("id", productId);
}

/** Assign (or unassign with an empty product) one image. */
export async function assignImage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminDb();
  const id = fd.get("image_id");
  const productId = fd.get("product_id");
  if (!isUuid(id) || (productId && !isUuid(productId))) return { error: "Choose a product." };
  const { data: img, error } = await supabase
    .from("product_images")
    .update({ product_id: (productId as string) || null })
    .eq("id", id)
    .select("path")
    .single();
  if (error || !img) return { error: "Could not save." };
  if (!productId) await clearMainIfUsing(img.path);
  else await ensureMainImage(productId as string);
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
  const url = supabase.storage.from(BUCKET).getPublicUrl(img.path).data.publicUrl;
  const { error } = await supabase.from("products").update({ image_url: url }).eq("id", img.product_id);
  if (error) return { error: "Could not save." };
  updateTag("catalog");
  refresh();
  return { ok: "Main photo set." };
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
