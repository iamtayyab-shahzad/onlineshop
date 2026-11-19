import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/admin/action-form";
import { inputCls } from "@/components/admin/admin-ui";
import { reviewProof } from "@/app/admin/_actions/orders";
import { formatPrice } from "@/lib/format";
import { PAYMENT_LABEL, formatDate, type PaymentMethod } from "@/lib/orders";

type Proof = {
  id: string;
  method: PaymentMethod;
  amount: number | null;
  transaction_ref: string | null;
  screenshot_path: string | null;
  status: "submitted" | "verified" | "rejected";
  admin_note: string | null;
  created_at: string;
};

const TONE = { submitted: "bg-amber-50", verified: "bg-emerald-50", rejected: "bg-red-50" } as const;

/** One payment proof with its private screenshot (short-lived signed link) and verify / reject buttons. */
export async function ProofReview({ proof: p }: { proof: Proof }) {
  let shot: string | null = null;
  if (p.screenshot_path) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(p.screenshot_path, 600);
    shot = data?.signedUrl ?? null;
  }
  return (
    <div className={`rounded-lg border p-3 text-sm ${TONE[p.status]}`}>
      <div className="flex flex-wrap justify-between gap-2">
        <span className="font-semibold">
          {PAYMENT_LABEL[p.method]} {p.amount ? `· ${formatPrice(p.amount)}` : ""}
        </span>
        <span className="text-muted-foreground">{formatDate(p.created_at)}</span>
      </div>
      <p>
        Transaction ID: <span className="font-mono font-semibold">{p.transaction_ref ?? "—"}</span>
      </p>
      {shot && (
        <a href={shot} target="_blank" rel="noreferrer" className="mt-2 block w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shot} alt="Payment screenshot" className="max-h-48 rounded border" />
        </a>
      )}
      {p.admin_note && <p className="mt-1 text-muted-foreground">Note: {p.admin_note}</p>}
      {p.status === "submitted" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <ActionForm
            action={reviewProof}
            submit="Money received — mark paid"
            inline
            confirm="Did you check that this money arrived in your account?"
          >
            <input type="hidden" name="proof_id" value={p.id} />
            <input type="hidden" name="decision" value="verified" />
          </ActionForm>
          <ActionForm action={reviewProof} submit="Reject" danger inline>
            <input type="hidden" name="proof_id" value={p.id} />
            <input type="hidden" name="decision" value="rejected" />
            <input name="admin_note" placeholder="Reason" maxLength={300} className={inputCls + " w-40"} />
          </ActionForm>
        </div>
      ) : (
        <p className="mt-1 font-semibold">{p.status === "verified" ? "Verified ✓" : "Rejected"}</p>
      )}
    </div>
  );
}
