"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import type { Address } from "@/lib/account";
import { saveAddress } from "../actions";

export function AddressForm({
  address,
  defaults,
  next,
}: {
  address?: Address;
  defaults: { recipient_name: string; phone: string };
  next: string;
}) {
  const [state, action] = useActionState(saveAddress, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      {address && <input type="hidden" name="id" value={address.id} />}
      <input type="hidden" name="next" value={next} />
      <FormError message={state?.error} />

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-base font-semibold">Save as</legend>
        <div className="flex gap-2">
          {["Home", "Office", "Other"].map((l) => (
            <label
              key={l}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 text-base font-medium has-checked:border-primary has-checked:bg-secondary"
            >
              <input
                type="radio"
                name="label"
                value={l}
                defaultChecked={(address?.label ?? "Home") === l}
                className="size-4 accent-primary"
              />
              {l}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Receiver's name"
        name="recipient_name"
        required
        maxLength={80}
        autoComplete="name"
        defaultValue={address?.recipient_name ?? defaults.recipient_name}
      />
      <Field
        label="Receiver's mobile number"
        name="phone"
        type="tel"
        inputMode="tel"
        required
        maxLength={20}
        autoComplete="tel"
        placeholder="0300 1234567"
        defaultValue={address?.phone ?? defaults.phone}
      />
      <Field
        label="Area / sector"
        name="area"
        required
        maxLength={80}
        placeholder="e.g. Gulshan-e-Iqbal Block 5"
        defaultValue={address?.area}
      />
      <Field
        label="House, street and full address"
        name="address_line"
        multiline
        rows={3}
        required
        maxLength={300}
        placeholder="e.g. House 12, Street 4"
        defaultValue={address?.address_line}
      />
      <Field
        label="Nearby landmark (optional)"
        name="landmark"
        maxLength={150}
        placeholder="e.g. Near Al-Noor Mosque"
        defaultValue={address?.landmark ?? ""}
      />
      {!address?.is_default && (
        <label className="flex min-h-12 items-center gap-3 text-base">
          <input type="checkbox" name="is_default" className="size-5 accent-primary" />
          Use this as my main address
        </label>
      )}
      <SubmitButton pendingText="Saving…">Save address</SubmitButton>
    </form>
  );
}
