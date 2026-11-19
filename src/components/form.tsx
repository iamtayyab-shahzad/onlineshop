"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Large, clearly labelled text field for non-technical users. */
export function Field({
  label,
  hint,
  name,
  className,
  multiline,
  rows,
  ...props
}: {
  label: string;
  hint?: string;
  name: string;
  multiline?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement> &
  Pick<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "rows">) {
  const id = `f-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const inputClass =
    "w-full rounded-xl border-2 border-input bg-card px-4 text-lg outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/25";
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-base font-semibold">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name={name}
          aria-describedby={hintId}
          rows={rows ?? 3}
          maxLength={props.maxLength}
          defaultValue={props.defaultValue}
          placeholder={props.placeholder}
          required={props.required}
          className={cn(inputClass, "py-3")}
        />
      ) : (
        <input id={id} name={name} aria-describedby={hintId} className={cn(inputClass, "h-14")} {...props} />
      )}
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-base font-medium text-destructive">
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-xl bg-secondary p-3 text-base font-medium text-primary">
      {message}
    </p>
  );
}

/** Submit button that shows a spinner and blocks double taps while the form is sending. */
export function SubmitButton({
  children,
  pendingText = "Please wait…",
  className,
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  variant?: "primary" | "outline" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "flex h-14 w-full items-center justify-center gap-2 rounded-xl text-lg font-bold disabled:opacity-70",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "outline" && "border-2 bg-card",
        variant === "danger" && "border-2 border-destructive/40 bg-card text-destructive",
        className,
      )}
    >
      {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {pending ? pendingText : children}
    </button>
  );
}
