"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { submitPaymentProof } from "@/app/(shop)/account/orders/proof-actions";

/** Shrink a screenshot before upload (phones make big PNGs). */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error())), "image/webp", 0.8));
}

/**
 * "I have paid" form: transaction ID plus an optional screenshot.
 * Never asks for a PIN, password or card details.
 */
export function PaymentProofForm({ orderId, userId }: { orderId: string; userId: string }) {
  const [ref, setRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (msg?.ok) {
    return (
      <p role="status" className="rounded-2xl bg-secondary p-4 text-base font-semibold">
        Thank you! We received your payment details and will check them soon.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        let path: string | null = null;
        try {
          if (file) {
            path = `${userId}/${crypto.randomUUID()}.webp`;
            const { error } = await createBrowserSupabase()
              .storage.from("payment-proofs")
              .upload(path, await shrink(file), { contentType: "image/webp" });
            if (error) throw error;
          }
          const res = await submitPaymentProof({ orderId, transactionRef: ref, screenshotPath: path });
          setMsg({ ok: res.ok, text: res.error ?? "" });
        } catch {
          setMsg({ ok: false, text: "Could not upload the screenshot. Please try again." });
        }
        setBusy(false);
      }}
    >
      <h2 className="text-lg font-bold">Already paid? Tell us</h2>
      <label className="flex flex-col gap-1 text-base font-semibold">
        Transaction ID (TID)
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          maxLength={60}
          inputMode="text"
          autoComplete="off"
          placeholder="e.g. 012345678901"
          className="h-12 rounded-xl border-2 px-3 text-lg"
        />
      </label>
      <label className="flex flex-col gap-1 text-base font-semibold">
        Screenshot (optional)
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-base font-normal"
        />
      </label>
      <p className="text-sm text-muted-foreground">Do not send your PIN, password or OTP. We never need them.</p>
      {msg && !msg.ok && (
        <p role="alert" className="text-base font-medium text-destructive">
          {msg.text}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="h-12 rounded-xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send payment details"}
      </button>
    </form>
  );
}
