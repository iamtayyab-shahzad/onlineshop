"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { sendLoginCode, verifyLoginCode } from "@/app/admin/_actions/login-code";
import { signOut } from "@/app/auth-actions";
import type { ActionState } from "@/lib/admin-types";

const KEY = "admin-code-sent-at";

/** Second step of the admin sign-in: type the 6-digit code that arrived on WhatsApp. */
export function CodeStep() {
  const [state, verify] = useActionState(verifyLoginCode, null);
  const [sent, setSent] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  const auto = useRef(false);

  function send() {
    start(async () => {
      const r = await sendLoginCode();
      setSent(r);
      if (r?.ok) {
        try {
          sessionStorage.setItem(KEY, String(Date.now()));
        } catch {
          /* private mode: fine */
        }
      }
    });
  }

  // Send the first code automatically, unless one was sent in the last minute (page reload).
  useEffect(() => {
    if (auto.current) return;
    auto.current = true;
    let recent = false;
    try {
      recent = Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 60_000;
    } catch {
      /* ignore */
    }
    if (recent) setSent({ ok: "A code was sent to your WhatsApp a moment ago." });
    else send();
  }, []);

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div>
        <p className="text-lg font-bold">Enter the code from WhatsApp</p>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to your admin WhatsApp number. It can take a minute to arrive.
        </p>
      </div>

      <form action={verify} className="flex flex-col gap-3">
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="[0-9]{6}"
          required
          autoFocus
          placeholder="______"
          aria-label="6-digit code"
          className="h-14 rounded-lg border-2 px-3 text-center text-2xl font-bold tracking-[0.5em] outline-none focus-visible:border-primary"
        />
        <Verify />
        {state?.error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.error}
          </p>
        )}
      </form>

      <div className="flex flex-col gap-2 border-t pt-3">
        {pending && <p className="text-sm text-muted-foreground">Sending the code…</p>}
        {!pending && sent?.ok && (
          <p role="status" className="text-sm font-medium text-primary">
            {sent.ok}
          </p>
        )}
        {!pending && sent?.error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {sent.error}
          </p>
        )}
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="h-10 w-fit rounded-lg border-2 px-4 text-sm font-semibold disabled:opacity-60"
        >
          Send a new code
        </button>
      </div>

      <form action={signOut}>
        <button type="submit" className="text-sm text-muted-foreground underline">
          Sign out
        </button>
      </form>
    </div>
  );
}

function Verify() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 rounded-lg bg-primary px-4 text-base font-semibold text-primary-foreground disabled:opacity-60"
    >
      {pending ? "Checking…" : "Sign in"}
    </button>
  );
}
