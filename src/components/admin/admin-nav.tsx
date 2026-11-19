"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CreditCard,
  Images,
  LayoutDashboard,
  Mic,
  Package,
  Ruler,
  Settings,
  Tags,
  Truck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/deliveries", label: "Deliveries", icon: Truck },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/voice", label: "Voice orders", icon: Mic },
  { href: "/admin/products", label: "Products", icon: Boxes },
  { href: "/admin/images", label: "Images", icon: Images },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/units", label: "Units", icon: Ruler },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

/** Sidebar on desktop, a sideways-scrolling tab bar on phones. */
export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap",
              active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
