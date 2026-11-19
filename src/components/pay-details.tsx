import type { PaymentDetails } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import type { PaymentMethod } from "@/lib/orders";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold break-all">{value}</dd>
    </div>
  );
}

const TITLE: Record<Exclude<PaymentMethod, "cod">, string> = {
  jazzcash: "Send to our JazzCash account",
  easypaisa: "Send to our Easypaisa account",
  bank_transfer: "Send to our bank account",
};

/** Where to send an online payment: number, account name, and QR code if the shop added one. */
export function PayDetails({
  method,
  pay,
  total,
  orderNumber,
}: {
  method: PaymentMethod;
  pay: PaymentDetails;
  total: number;
  orderNumber: number;
}) {
  if (method === "cod") return null;
  const qr =
    method === "jazzcash" ? pay.jazzcash_qr_url : method === "easypaisa" ? pay.easypaisa_qr_url : pay.bank_qr_url;
  const hasDetails =
    method === "jazzcash"
      ? pay.jazzcash_number
      : method === "easypaisa"
        ? pay.easypaisa_number
        : pay.bank_account_number || pay.bank_iban;
  return (
    <section className="rounded-2xl border-2 border-primary bg-card p-4">
      <h2 className="mb-3 text-lg font-bold">{TITLE[method]}</h2>
      <dl className="flex flex-col gap-2">
        {method === "jazzcash" && (
          <>
            <Row label="JazzCash number" value={pay.jazzcash_number} />
            <Row label="Account name" value={pay.jazzcash_account_name} />
          </>
        )}
        {method === "easypaisa" && (
          <>
            <Row label="Easypaisa number" value={pay.easypaisa_number} />
            <Row label="Account name" value={pay.easypaisa_account_name} />
          </>
        )}
        {method === "bank_transfer" && (
          <>
            <Row label="Bank" value={pay.bank_name} />
            <Row label="Account title" value={pay.bank_account_title} />
            <Row label="Account number" value={pay.bank_account_number} />
            <Row label="IBAN" value={pay.bank_iban} />
          </>
        )}
        <Row label="Amount" value={formatPrice(total)} />
        <Row label="Reference (write this in the message)" value={String(orderNumber)} />
      </dl>
      {qr && (
        <div className="mt-3 flex flex-col items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Payment QR code" className="size-56 rounded-xl border bg-white object-contain" />
          <p className="text-sm text-muted-foreground">Scan this in your app to pay</p>
        </div>
      )}
      {!hasDetails && <p className="mt-2 text-base">We will call you with the payment details.</p>}
    </section>
  );
}
