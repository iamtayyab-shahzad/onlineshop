import type { Metadata } from "next";
import Link from "next/link";
import { Clock, MapPin, MessageCircle, Phone, Mic } from "lucide-react";
import { getStoreSettings } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { PageTitle } from "@/components/page-title";

export const metadata: Metadata = { title: "Help & contact" };

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** 0300-1234567 → https://wa.me/923001234567 (Pakistan numbers). */
function whatsappHref(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

const STEPS = [
  "Find your items by category or search, and tap “Add to cart”.",
  "Open your cart, check the quantities and tap “Continue to checkout”.",
  "Choose your address and how you will pay: cash on delivery, JazzCash or bank transfer.",
  "We confirm your order, get it packed and deliver it to your door.",
];

export default async function HelpPage() {
  const s = await getStoreSettings();

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Help & contact" />

      <section aria-label="Contact" className="flex flex-col gap-3">
        {s.support_phone && (
          <a
            href={telHref(s.support_phone)}
            className="flex h-16 items-center gap-3 rounded-2xl bg-primary px-4 text-lg font-semibold text-primary-foreground"
          >
            <Phone className="size-6" />
            Call us: {s.support_phone}
          </a>
        )}
        {s.support_whatsapp && (
          <a
            href={whatsappHref(s.support_whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-16 items-center gap-3 rounded-2xl border-2 px-4 text-lg font-semibold"
          >
            <MessageCircle className="size-6" />
            Message on WhatsApp (optional)
          </a>
        )}
      </section>

      <section aria-labelledby="delivery-heading" className="rounded-2xl border bg-card p-4">
        <h2 id="delivery-heading" className="mb-3 text-xl font-bold">
          Delivery
        </h2>
        <ul className="flex flex-col gap-3 text-lg">
          {s.delivery_hours && (
            <li className="flex gap-3">
              <Clock className="mt-1 size-5 shrink-0 text-primary" />
              <span>{s.delivery_hours}</span>
            </li>
          )}
          {s.delivery_areas && (
            <li className="flex gap-3">
              <MapPin className="mt-1 size-5 shrink-0 text-primary" />
              <span>{s.delivery_areas}</span>
            </li>
          )}
          <li>
            Delivery charge: <strong>{formatPrice(s.delivery_fee)}</strong>
          </li>
          <li>
            Minimum order: <strong>{formatPrice(s.min_order_amount)}</strong>
          </li>
        </ul>
      </section>

      <Link
        href="/voice-order"
        className="flex min-h-20 items-center gap-4 rounded-2xl border-2 border-primary bg-secondary p-4 active:opacity-80"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Mic className="size-6" aria-hidden />
        </span>
        <span>
          <span className="block text-lg font-bold">Order by voice</span>
          <span className="block text-sm text-muted-foreground">Just say your list. We will call you to confirm.</span>
        </span>
      </Link>

      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="mb-3 text-xl font-bold">
          How to order
        </h2>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3 text-lg">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-primary">
                {i + 1}
              </span>
              <span className="pt-1">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="safety-heading" className="rounded-2xl bg-notice p-4 text-notice-foreground">
        <h2 id="safety-heading" className="mb-2 text-lg font-bold">
          Keep your money safe
        </h2>
        <p className="text-base">
          We will <strong>never</strong> ask for your JazzCash PIN, bank password, card CVV or any OTP code. Do not
          share them with anyone, even if they say they are from our shop.
        </p>
      </section>
    </div>
  );
}
