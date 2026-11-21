import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/auth";
import { AdminTitle, Card } from "@/components/admin/admin-ui";
import { createOrderFromVoice } from "@/app/admin/_actions/order-edit";
import { OrderEditor } from "../../../orders/order-editor";
import { isUuid } from "@/lib/admin-types";
import { formatDate } from "@/lib/orders";

export const metadata: Metadata = { title: "Create order" };

export default async function VoiceToOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase } = await adminDb();
  const [{ data: v }, { data: settings }] = await Promise.all([
    supabase
      .from("voice_orders")
      .select(
        "id, audio_path, duration_seconds, customer_note, status, created_at, profiles(full_name, phone), addresses(recipient_name, phone, address_line, area, landmark), orders(id, order_number)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("store_settings").select("delivery_fee").eq("id", true).maybeSingle(),
  ]);
  if (!v) notFound();

  const { data: signed } = await supabase.storage.from("voice-orders").createSignedUrl(v.audio_path, 3600);
  const a = v.addresses;
  const phone = a?.phone ?? v.profiles?.phone;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <AdminTitle title="Create order from voice message" backHref="/admin/voice" />
      <Card>
        <p className="font-semibold">
          {a?.recipient_name || v.profiles?.full_name || "Customer"}
          {phone && (
            <>
              {" · "}
              <a href={`tel:${phone}`} className="text-primary">
                {phone}
              </a>
            </>
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          Sent {formatDate(v.created_at)}
          {v.duration_seconds ? ` · ${v.duration_seconds}s` : ""}
        </p>
        {a ? (
          <p className="mt-1 text-sm">
            Deliver to: {a.address_line}, {a.area}
            {a.landmark ? ` (near ${a.landmark})` : ""}
          </p>
        ) : (
          <p className="mt-1 text-sm text-amber-700">
            This voice message has no address. The customer&apos;s saved address is used if they have one.
          </p>
        )}
        {v.customer_note && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Note: {v.customer_note}</p>}
        {signed?.signedUrl ? (
          <audio controls preload="none" src={signed.signedUrl} className="mt-3 w-full" />
        ) : (
          <p className="mt-3 text-sm text-destructive">Audio file not found.</p>
        )}
      </Card>

      {v.orders ? (
        <Card>
          <p className="text-sm">
            An order was already made from this message:{" "}
            <Link href={`/admin/orders/${v.orders.id}`} className="font-semibold text-primary">
              order #{v.orders.order_number}
            </Link>
          </p>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Listen to the message, add what the customer asked for, then create the order. It goes to your orders list with
            the customer&apos;s name and address.
          </p>
          <OrderEditor
            action={createOrderFromVoice}
            hidden={{ voice_id: v.id }}
            submit="Create order"
            initialItems={[]}
            initialDiscount={0}
            initialFee={Number(settings?.delivery_fee ?? 0)}
            initialNote={v.customer_note ?? ""}
            noteLabel="Note on the order (optional)"
            paymentChoice
          />
        </>
      )}
    </div>
  );
}
