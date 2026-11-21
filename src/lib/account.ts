import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Customer data, read AS the signed-in customer. Row Level Security returns only
 * their own rows; the explicit user_id filters are a second safety net.
 * Supplier prices are never selected here (and RLS would hide them anyway).
 */

export type Address = {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  area: string;
  address_line: string;
  landmark: string | null;
  is_default: boolean;
};

const ADDRESS_COLUMNS = "id, label, recipient_name, phone, area, address_line, landmark, is_default";

export async function getMyAddresses(userId: string): Promise<Address[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("addresses")
    .select(ADDRESS_COLUMNS)
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load addresses: ${error.message}`);
  return data;
}

export async function getMyAddress(userId: string, id: string): Promise<Address | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("addresses")
    .select(ADDRESS_COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function getMyOrders(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, total, created_at, payment_method, order_items(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Could not load orders: ${error.message}`);
  return data;
}

export async function getMyOrder(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, order_number, status, payment_method, payment_status, created_at,
       delivery_name, delivery_phone, delivery_area, delivery_address, delivery_landmark,
       customer_note, subtotal, delivery_fee, discount, total,
       order_items(id, product_id, product_name, unit_label, unit_name, unit_price, quantity, line_total, amount_requested),
       order_status_events(status, created_at),
       payment_proofs(id, status, transaction_ref, created_at)`,
    )
    .eq("user_id", userId)
    .eq("id", id)
    .order("created_at", { referencedTable: "order_status_events", ascending: true })
    .maybeSingle();
  if (error) throw new Error(`Could not load order: ${error.message}`);
  return data;
}
