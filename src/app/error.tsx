"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-2xl bg-muted p-8 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-lg text-muted-foreground">Please check your internet connection and try again.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex h-12 items-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}
