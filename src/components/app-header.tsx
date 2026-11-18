import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { getStoreSettings } from "@/lib/catalog";

export async function AppHeader() {
  const settings = await getStoreSettings();
  return (
    <header className="sticky top-0 z-30 border-b bg-primary text-primary-foreground">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold">
          {settings.store_name}
        </Link>
        <Link
          href="/help"
          className="flex h-11 items-center gap-1.5 rounded-lg px-3 text-base font-medium active:bg-white/15"
        >
          <CircleHelp className="size-5" />
          Help
        </Link>
      </div>
    </header>
  );
}

export function AppHeaderFallback() {
  return <header className="sticky top-0 z-30 h-14 border-b bg-primary" />;
}
