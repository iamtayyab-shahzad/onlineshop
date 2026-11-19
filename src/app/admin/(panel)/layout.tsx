import Link from "next/link";
import { Suspense } from "react";
import { LogOut, Store } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { BlockSkeleton } from "@/components/skeletons";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/app/auth-actions";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:flex">
      <aside className="sticky top-0 z-20 border-b bg-card md:h-dvh md:w-56 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 pt-3 md:pb-2">
          <p className="text-lg font-bold">Shop admin</p>
          <div className="flex gap-1">
            <Link href="/" className="rounded-lg p-2 hover:bg-muted" aria-label="Open the shop" title="Open the shop">
              <Store className="size-5" />
            </Link>
            <form action={signOut}>
              <button type="submit" className="rounded-lg p-2 hover:bg-muted" aria-label="Sign out" title="Sign out">
                <LogOut className="size-5" />
              </button>
            </form>
          </div>
        </div>
        <Suspense>
          <AdminNav />
        </Suspense>
      </aside>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
        <Suspense fallback={<BlockSkeleton />}>
          <Guard>{children}</Guard>
        </Suspense>
      </main>
    </div>
  );
}

/** Server-side role check before anything renders. Pages and actions check again. */
async function Guard({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
