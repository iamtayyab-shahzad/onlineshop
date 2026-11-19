"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signIn, signUp } from "@/app/auth-actions";
import { Field, FormError, SubmitButton } from "@/components/form";

export function AuthForm({
  mode,
  next,
  adminOnly,
}: {
  mode: "signin" | "signup";
  next: string;
  /** Admin sign-in: no "create an account" links. */
  adminOnly?: boolean;
}) {
  const [state, action] = useActionState(mode === "signin" ? signIn : signUp, null);
  const [showPassword, setShowPassword] = useState(false);
  const nextQuery = next !== "/account" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormError message={state?.error} />

      {mode === "signup" && (
        <Field
          label="Your name"
          name="fullName"
          autoComplete="name"
          required
          maxLength={80}
          defaultValue={state?.values?.fullName}
          placeholder="e.g. Ayesha Khan"
        />
      )}

      <Field
        label="Mobile number"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        maxLength={20}
        defaultValue={state?.values?.phone}
        placeholder="0300 1234567"
        hint={mode === "signup" ? "We will call this number about your orders." : undefined}
      />

      <div className="flex flex-col gap-2">
        <Field
          label={mode === "signup" ? "Choose a password" : "Password"}
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={mode === "signup" ? 6 : undefined}
          maxLength={72}
          hint={mode === "signup" ? "At least 6 letters or numbers. Do not use your bank or JazzCash PIN." : undefined}
        />
        <label className="flex h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(e) => setShowPassword(e.target.checked)}
            className="size-5 accent-primary"
          />
          Show password
        </label>
      </div>

      <SubmitButton pendingText={mode === "signin" ? "Signing in…" : "Creating account…"}>
        {mode === "signin" ? "Sign in" : "Create account"}
      </SubmitButton>

      {adminOnly ? null : mode === "signin" ? (
        <div className="flex flex-col gap-3 border-t pt-4 text-center">
          <p className="text-base">New here?</p>
          <Link
            href={`/signup${nextQuery}`}
            className="flex h-14 items-center justify-center rounded-xl border-2 text-lg font-semibold"
          >
            Create an account
          </Link>
          <p className="text-sm text-muted-foreground">
            Forgot your password?{" "}
            <Link href="/help" className="font-semibold text-primary underline">
              Call us
            </Link>{" "}
            and we will reset it.
          </p>
        </div>
      ) : (
        <p className="border-t pt-4 text-center text-base">
          Already have an account?{" "}
          <Link href={`/login${nextQuery}`} className="font-semibold text-primary underline">
            Sign in
          </Link>
        </p>
      )}
    </form>
  );
}
