import Form from "next/form";
import { Search } from "lucide-react";

/** Plain GET form to /search, so it works even before JavaScript loads. */
export function SearchBox({ defaultValue, autoFocus }: { defaultValue?: string; autoFocus?: boolean }) {
  return (
    <Form action="/search" role="search" className="relative">
      <label htmlFor="q" className="sr-only">
        Search products
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="Search atta, rice, daal…"
        enterKeyHint="search"
        maxLength={60}
        className="h-14 w-full rounded-xl border-2 bg-background pr-24 pl-12 text-lg outline-none focus:border-primary"
      />
      <button
        type="submit"
        className="absolute top-1.5 right-1.5 h-11 rounded-lg bg-primary px-4 text-base font-semibold text-primary-foreground"
      >
        Search
      </button>
    </Form>
  );
}
