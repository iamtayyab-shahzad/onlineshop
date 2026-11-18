import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AppHeader, AppHeaderFallback } from "@/components/app-header";
import { BottomNav, BottomNavFallback } from "@/components/bottom-nav";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Grocery Shop", template: "%s · Grocery Shop" },
  description: "Order your monthly groceries online. Delivered to your door.",
  applicationName: "Grocery Shop",
  appleWebApp: { capable: true, title: "Grocery", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#2f8a4c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <Suspense fallback={<AppHeaderFallback />}>
          <AppHeader />
        </Suspense>
        <main className="mx-auto max-w-3xl px-4 pt-4 pb-28">{children}</main>
        <Suspense fallback={<BottomNavFallback />}>
          <BottomNav />
        </Suspense>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
