"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/admin-types";

/**
 * A form that posts to an admin server action and shows its result.
 * `confirm` asks before submitting (used for anything destructive).
 */
export function ActionForm({
  action,
  children,
  submit,
  confirm: confirmText,
  danger,
  className,
  inline,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submit: string;
  confirm?: string;
  danger?: boolean;
  className?: string;
  inline?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className={cn(inline ? "inline-flex flex-wrap items-center gap-2" : "flex flex-col gap-3", className)}
    >
      {children}
      <Submit danger={danger}>{submit}</Submit>
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm font-medium text-primary">
          {state.ok}
        </p>
      )}
    </form>
  );
}

function Submit({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex h-10 w-fit items-center justify-center rounded-lg px-4 text-sm font-semibold disabled:opacity-60",
        danger ? "border-2 border-destructive text-destructive" : "bg-primary text-primary-foreground",
      )}
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}

/** Copies text (e.g. the WhatsApp packing list) to the clipboard. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={async (e) => {
        const btn = e.currentTarget;
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = "Copied ✓";
        } catch {
          btn.textContent = "Copy failed";
        }
        setTimeout(() => (btn.textContent = label), 2000);
      }}
      className="inline-flex h-10 items-center rounded-lg border-2 px-4 text-sm font-semibold"
    >
      {label}
    </button>
  );
}
