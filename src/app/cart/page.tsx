import type { Metadata } from "next";
import { getStoreSettings } from "@/lib/catalog";
import { CartView } from "./cart-view";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const settings = await getStoreSettings();
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Your cart</h1>
      <CartView deliveryFee={settings.delivery_fee} minOrder={settings.min_order_amount} />
    </>
  );
}
