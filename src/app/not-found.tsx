import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-8 max-w-md rounded-2xl bg-muted p-8 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-lg text-muted-foreground">This item or page is no longer available.</p>
      <Link
        href="/"
        className="mt-5 inline-flex h-12 items-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground"
      >
        Go to home
      </Link>
    </div>
  );
}
