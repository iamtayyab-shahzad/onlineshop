"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { registerImages, type UploadedImage } from "@/app/admin/_actions/images";

const MAX_SIDE = 1000;

/** Resize to at most 1000px and encode as WebP (also strips camera metadata). */
export async function toWebp(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  if (file.type === "image/webp" && scale === 1 && file.size < 300_000) {
    bmp.close();
    return { blob: file, width, height };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/webp", 0.82),
  );
  return { blob, width, height };
}

async function sha256(blob: Blob): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Bulk photo upload for the admin. Files go straight from the browser to
 * Supabase Storage under the admin's session (Storage RLS: admins only),
 * named by their SHA-256 so the same photo is never stored twice.
 */
export function ImageUploader({ productId }: { productId?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMsg(null);
    const supabase = createBrowserSupabase();
    const done: UploadedImage[] = [];
    let failed = 0;
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      setMsg(`Uploading ${i + 1} of ${list.length}…`);
      try {
        const { blob, width, height } = await toWebp(f);
        const hash = await sha256(blob);
        const path = `library/${hash}.webp`;
        const { error } = await supabase.storage
          .from("product-images")
          .upload(path, blob, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
        // "already exists" = same photo uploaded before; still register it.
        if (error && !/exist|duplicate/i.test(error.message)) throw error;
        done.push({ path, sha256: hash, original_name: f.name, width, height });
      } catch {
        failed++;
      }
    }
    const res = done.length ? await registerImages(done, productId) : { added: 0, duplicates: 0 };
    setBusy(false);
    setMsg(
      res.error ??
        `${res.added} new image(s) added` +
          (res.duplicates ? `, ${res.duplicates} already in the library` : "") +
          (failed ? `, ${failed} failed` : "") +
          ".",
    );
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div
      className="flex flex-col items-start gap-2 rounded-xl border-2 border-dashed bg-card p-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!busy) upload(e.dataTransfer.files);
      }}
    >
      <p className="font-semibold">{productId ? "Add photos to this product" : "Upload product photos"}</p>
      <p className="text-sm text-muted-foreground">
        Pick or drop many photos at once. They are resized for phones (max 1000px, WebP). Name files like the product
        (e.g. <span className="font-mono">basmati-rice.jpg</span>) to get automatic match suggestions.
      </p>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={busy}
        onChange={(e) => upload(e.target.files)}
        className="text-sm file:mr-3 file:h-10 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:font-semibold file:text-primary-foreground"
      />
      {msg && (
        <p role="status" className="text-sm font-medium">
          {msg}
        </p>
      )}
    </div>
  );
}
