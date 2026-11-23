import type { Metadata } from "next";
import Link from "next/link";
import { adminDb } from "@/lib/auth";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, Card, Empty, inputCls } from "@/components/admin/admin-ui";
import { updateVoiceOrder } from "@/app/admin/_actions/orders";
import { resendVoiceAlert } from "@/app/admin/_actions/notifications";
import { formatDate } from "@/lib/orders";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Voice orders" };

const TABS = ["new", "converted", "rejected"] as const;
const TAB_LABEL = { new: "New", converted: "Done", rejected: "Rejected" };

export default async function VoicePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { supabase } = await adminDb();
  const { tab: raw } = await searchParams;
  const tab = TABS.find((t) => t === raw) ?? "new";
  const { data } = await supabase
    .from("voice_orders")
    .select(
      "id, audio_path, duration_seconds, customer_note, admin_note, status, created_at, alerted_at, alert_error, profiles(full_name, phone), addresses(recipient_name, phone, address_line, area, landmark), orders(id, order_number)",
    )
    .eq("status", tab)
    .order("created_at", { ascending: tab === "new" })
    .limit(50);

  // Private audio: short-lived signed links, only ever created for an admin.
  const paths = (data ?? []).map((v) => v.audio_path);
  const { data: signed } = paths.length
    ? await supabase.storage.from("voice-orders").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return (
    <div className="flex flex-col gap-4">
      <AdminTitle title="Voice orders" />
      <div className="flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/admin/voice?tab=${t}`}
            className={cn(
              "h-9 rounded-full border px-3 text-sm leading-9 font-medium",
              t === tab ? "border-primary bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            {TAB_LABEL[t]}
          </Link>
        ))}
      </div>
      {!data?.length && <Empty>No voice orders here.</Empty>}
      {data?.map((v) => {
        const src = urlFor.get(v.audio_path);
        const a = v.addresses;
        return (
          <Card key={v.id}>
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold">
                {v.profiles?.full_name || "Customer"} ·{" "}
                <a href={`tel:${a?.phone ?? v.profiles?.phone}`} className="text-primary">
                  {a?.phone ?? v.profiles?.phone}
                </a>
              </p>
              <span className="text-sm text-muted-foreground">
                {formatDate(v.created_at)}
                {v.duration_seconds ? ` · ${v.duration_seconds}s` : ""}
              </span>
            </div>
            {a && (
              <p className="text-sm">
                Deliver to {a.recipient_name}: {a.address_line}, {a.area}
                {a.landmark ? ` (near ${a.landmark})` : ""}
              </p>
            )}
            {v.customer_note && <p className="mt-1 rounded-lg bg-amber-50 p-2 text-sm">Note: {v.customer_note}</p>}
            {src ? (
              <audio controls preload="none" src={src} className="my-3 w-full" />
            ) : (
              <p className="my-3 text-sm text-destructive">Audio file not found.</p>
            )}
            {v.status === "new" && !v.alerted_at && (
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 p-2 text-sm">
                <span>
                  WhatsApp alert not sent{v.alert_error ? `: ${v.alert_error}` : " yet"}.
                </span>
                <ActionForm action={resendVoiceAlert} submit="Send alert" inline>
                  <input type="hidden" name="voice_id" value={v.id} />
                </ActionForm>
              </div>
            )}
            {v.status === "new" && !v.orders && (
              <Link
                href={`/admin/voice/${v.id}/order`}
                className="mb-3 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-base font-semibold text-primary-foreground"
              >
                Create order
              </Link>
            )}
            {v.orders && (
              <p className="mb-2 text-sm">
                Linked to{" "}
                <Link href={`/admin/orders/${v.orders.id}`} className="font-semibold text-primary">
                  order #{v.orders.order_number}
                </Link>
              </p>
            )}
            <ActionForm action={updateVoiceOrder} submit="Save" inline>
              <input type="hidden" name="voice_id" value={v.id} />
              <select name="status" defaultValue={v.status} className={inputCls + " w-auto"}>
                <option value="new">New</option>
                <option value="converted">Done (order made)</option>
                <option value="rejected">Rejected</option>
              </select>
              <input
                name="order_number"
                inputMode="numeric"
                placeholder="Order # (optional)"
                className={inputCls + " w-40"}
              />
              <input
                name="admin_note"
                defaultValue={v.admin_note ?? ""}
                placeholder="Your note"
                maxLength={500}
                className={inputCls + " w-56"}
              />
            </ActionForm>
          </Card>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Listen, then call the customer or create the order yourself. Nothing is sent to the customer automatically.
      </p>
    </div>
  );
}
