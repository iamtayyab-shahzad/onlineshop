"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, ShoppingCart, User } from "lucide-react";
import { useCartCount } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/cart", label: "Cart", icon: ShoppingCart },
  { href: "/account", label: "Account", icon: User },
] as const;

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();
  return <NavBar pathname={pathname} />;
}

/** Same bar without the active state; used while the route is resolving. */
export function BottomNavFallback() {
  return <NavBar pathname={null} />;
}

function NavBar({ pathname }: { pathname: string | null }) {
  const count = useCartCount();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-0.5 text-sm font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon className="size-6" strokeWidth={active ? 2.5 : 2} />
                  {href === "/cart" && count > 0 && (
                    <span className="absolute -top-2 -right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-strong px-1 text-xs font-bold text-white tabular-nums">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </span>
                {label}
                {href === "/cart" && count > 0 && <span className="sr-only">, {count} items</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
