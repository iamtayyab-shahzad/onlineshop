"use client";

import { useActionState } from "react";
import { Field, FormError, FormSuccess, SubmitButton } from "@/components/form";
import { updateProfile } from "../actions";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, action] = useActionState(updateProfile, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state?.error} />
      <FormSuccess message={state?.ok} />
      <Field label="Your name" name="fullName" required maxLength={80} defaultValue={fullName} autoComplete="name" />
      <div className="flex flex-col gap-1.5">
        <span className="text-base font-semibold">Mobile number</span>
        <p className="flex h-14 items-center rounded-xl bg-muted px-4 text-lg">{phone}</p>
        <p className="text-sm text-muted-foreground">This is your sign-in number. To change it, please call us.</p>
      </div>
      <SubmitButton pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}
