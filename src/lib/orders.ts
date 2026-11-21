import type { Database } from "@/lib/database.types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];

/**
 * Plain words customers understand. Orders have only three stages now (received, delivered, cancelled);
 * the older in-between values still exist in the database enum, so they are shown as "Order received".
 */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Order received",
  confirmed: "Order received",
  sent_to_shop: "Order received",
  packed: "Order received",
  out_for_delivery: "Order received",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const STATUS_STEPS: OrderStatus[] = ["placed", "delivered"];

/** The three stages the admin can choose. */
export const ADMIN_STATUSES: OrderStatus[] = ["placed", "delivered", "cancelled"];

/** Every status that means "not delivered or cancelled yet" (the new stage plus older in-between values). */
export const OPEN_STATUSES: OrderStatus[] = ["placed", "confirmed", "sent_to_shop", "packed", "out_for_delivery"];

export function isOpenStatus(status: OrderStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cod: "Cash on delivery",
  jazzcash: "JazzCash",
  bank_transfer: "Bank transfer",
  easypaisa: "Easypaisa",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Not paid yet",
  pending_verification: "Checking your payment",
  paid: "Paid",
  refunded: "Refunded",
};

export const PAYMENT_METHODS: PaymentMethod[] = ["cod", "jazzcash", "easypaisa", "bank_transfer"];

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Karachi",
  }).format(new Date(iso));
}
