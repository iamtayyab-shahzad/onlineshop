import type { Database } from "@/lib/database.types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];

/** Plain words customers understand. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Order received",
  confirmed: "Confirmed",
  sent_to_shop: "Being prepared",
  packed: "Packed",
  out_for_delivery: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const STATUS_STEPS: OrderStatus[] = [
  "placed",
  "confirmed",
  "sent_to_shop",
  "packed",
  "out_for_delivery",
  "delivered",
];

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
