import Link from "next/link";
import { cn } from "@/lib/utils";
import type { OrderStatus, PaymentStatus } from "@/lib/orders";

/** Small building blocks shared by the admin pages (desktop + phone friendly). */

export function AdminTitle({
  title,
  backHref,
  children,
}: {
  title: string;
  backHref?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        {backHref && (
          <Link href={backHref} className="text-sm font-medium text-primary">
            ← Back
          </Link>
        )}
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Card({ title, className, children }: { title?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border bg-card p-4", className)}>
      {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, href, tone }: { label: string; value: string | number; href?: string; tone?: "warn" }) {
  const body = (
    <>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-2xl font-bold tabular-nums", tone === "warn" && "text-amber-700")}>{value}</span>
    </>
  );
  const cls = "flex flex-col gap-1 rounded-xl border bg-card p-4";
  return href ? (
    <Link href={href} className={cn(cls, "hover:border-primary")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold",
        variant === "primary" ? "bg-primary text-primary-foreground" : "border-2 bg-background",
      )}
    >
      {children}
    </Link>
  );
}

const STATUS_TONE: Record<OrderStatus, string> = {
  placed: "bg-amber-100 text-amber-900",
  confirmed: "bg-sky-100 text-sky-900",
  sent_to_shop: "bg-indigo-100 text-indigo-900",
  packed: "bg-violet-100 text-violet-900",
  out_for_delivery: "bg-blue-100 text-blue-900",
  delivered: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-red-100 text-red-900",
};

export const ADMIN_STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "New",
  confirmed: "Confirmed",
  sent_to_shop: "Sent to shop",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_TONE[status])}>
      {ADMIN_STATUS_LABEL[status]}
    </span>
  );
}

const PAY_TONE: Record<PaymentStatus, string> = {
  unpaid: "bg-muted text-muted-foreground",
  pending_verification: "bg-amber-100 text-amber-900",
  paid: "bg-emerald-100 text-emerald-900",
  refunded: "bg-red-100 text-red-900",
};

const PAY_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  pending_verification: "Check payment",
  paid: "Paid",
  refunded: "Refunded",
};

export function PayBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", PAY_TONE[status])}>
      {PAY_LABEL[status]}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-muted p-6 text-center text-muted-foreground">{children}</p>;
}

/** Table that scrolls sideways on phones instead of breaking the layout. */
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b bg-muted/50 text-xs text-muted-foreground uppercase">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export const inputCls =
  "h-10 w-full rounded-lg border-2 border-input bg-background px-3 text-base outline-none focus-visible:border-primary";

export function Input({
  label,
  hint,
  className,
  ...props
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("flex flex-col gap-1 text-sm font-semibold", className)}>
      {label}
      <input className={inputCls} {...props} />
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Select({
  label,
  options,
  className,
  ...props
}: {
  label: string;
  options: { value: string; label: string }[];
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={cn("flex flex-col gap-1 text-sm font-semibold", className)}>
      {label}
      <select className={inputCls} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Check({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex h-10 items-center gap-2 text-sm font-semibold">
      <input type="checkbox" className="size-5 accent-primary" {...props} />
      {label}
    </label>
  );
}

/** The normal next step for an order, used by the one-tap buttons. */
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: "confirmed",
  confirmed: "sent_to_shop",
  sent_to_shop: "packed",
  packed: "out_for_delivery",
  out_for_delivery: "delivered",
};

/** Today's date in Pakistan as YYYY-MM-DD. */
export function pkDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(d);
}
