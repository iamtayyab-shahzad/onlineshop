import { Suspense } from "react";
import { AppHeader, AppHeaderFallback } from "@/components/app-header";
import { BottomNav, BottomNavFallback } from "@/components/bottom-nav";
import { ServiceWorkerRegister } from "@/components/sw-register";

/** Customer app shell (installable PWA). The admin panel has its own layout. */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<AppHeaderFallback />}>
        <AppHeader />
      </Suspense>
      <main className="mx-auto max-w-3xl px-4 pt-4 pb-28">{children}</main>
      <Suspense fallback={<BottomNavFallback />}>
        <BottomNav />
      </Suspense>
      <ServiceWorkerRegister />
    </>
  );
}
