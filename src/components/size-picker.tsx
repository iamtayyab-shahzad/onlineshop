import Link from "next/link";
import type { Size } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Size chooser on a product page ("1 kg  Rs 900", "500 g  Rs 480", ...).
 * Each size is its own product page, so the chips are plain links; the chosen one is highlighted.
 */
export function SizePicker({ sizes, currentId }: { sizes: Size[]; currentId: string }) {
  if (sizes.length < 2) return null;
  return (
    <section aria-label="Choose a size" className="flex flex-col gap-2">
      <p className="text-base font-semibold">Choose a size</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {sizes.map((s) => {
          const selected = s.id === currentId;
          return (
            <Link
              key={s.id}
              href={`/product/${s.slug}`}
              replace
              scroll={false}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "flex min-h-16 flex-col justify-center rounded-xl border-2 px-3 py-2",
                selected ? "border-primary bg-primary/10" : "border-border bg-card",
                !s.in_stock && "opacity-60",
              )}
            >
              <span className="text-base font-bold">{s.unit_label}</span>
              <span className="text-base">{formatPrice(s.selling_price)}</span>
              {!s.in_stock && <span className="text-sm text-destructive">Out of stock</span>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
