import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

/** Admin area: no customer header, bottom bar or service worker (not part of the installable app). */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-muted/40 text-[15px]">{children}</div>;
}
