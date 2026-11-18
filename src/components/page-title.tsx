import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageTitle({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
}: {
  title: string;
  subtitle?: string | null;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-4">
      {backHref && (
        <Link
          href={backHref}
          className="-ml-2 mb-1 inline-flex h-11 items-center gap-1 rounded-lg px-2 text-base font-medium text-primary"
        >
          <ChevronLeft className="size-5" />
          {backLabel}
        </Link>
      )}
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && (
        <p className="text-base text-muted-foreground" lang="ur" dir="auto">
          {subtitle}
        </p>
      )}
    </div>
  );
}
