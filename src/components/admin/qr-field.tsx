"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { toWebp } from "./image-uploader";

/** Upload a payment QR code image; the form saves its public link. */
export function QrField({ name, label, current }: { name: string; label: string; current: string | null }) {
  const [url, setUrl] = useState(current ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2 text-sm font-semibold">
      {label}
      <input type="hidden" name={name} value={url} />
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="size-36 rounded-lg border bg-white object-contain" />
      ) : (
        <span className="text-xs font-normal text-muted-foreground">No QR code</span>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-xs font-normal"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setMsg("Uploading…");
            try {
              const { blob } = await toWebp(f);
              const path = `store/${name}-${Date.now()}.webp`;
              const supabase = createBrowserSupabase();
              const { error } = await supabase.storage
                .from("product-images")
                .upload(path, blob, { contentType: "image/webp" });
              if (error) throw error;
              setUrl(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
              setMsg("Uploaded — press Save to keep it.");
            } catch {
              setMsg("Upload failed.");
            }
          }}
        />
        {url && (
          <button type="button" onClick={() => setUrl("")} className="text-xs text-destructive underline">
            Remove
          </button>
        )}
      </div>
      {msg && <span className="text-xs font-normal">{msg}</span>}
    </div>
  );
}
