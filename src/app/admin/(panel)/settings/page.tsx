import type { Metadata } from "next";
import { adminDb } from "@/lib/auth";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, Card, Check, Input, inputCls } from "@/components/admin/admin-ui";
import { QrField } from "@/components/admin/qr-field";
import { savePaymentAccounts, saveShop, saveStoreSettings } from "@/app/admin/_actions/settings";
import { retryFailedNotifications, saveNotificationSettings, setLoginCodeCheck } from "@/app/admin/_actions/notifications";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase } = await adminDb();
  const [{ data: s }, { data: shop }, { data: alerts }, { count: failedAlerts }] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", true).single(),
    supabase.from("shops").select("id, name, whatsapp_phone, address").eq("is_default", true).maybeSingle(),
    supabase
      .from("notification_settings")
      .select("alerts_enabled, admin_whatsapp, require_login_code")
      .eq("id", true)
      .maybeSingle(),
    supabase.from("order_notifications").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);
  if (!s) return <p>Store settings row is missing.</p>;
  return (
    <div className="flex flex-col gap-4">
      <AdminTitle title="Settings" />

      <Card title="Store">
        <ActionForm action={saveStoreSettings} submit="Save store">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Store name" name="store_name" defaultValue={s.store_name} maxLength={80} />
            <Input label="Support phone" name="support_phone" defaultValue={s.support_phone ?? ""} inputMode="tel" />
            <Input label="Support WhatsApp" name="support_whatsapp" defaultValue={s.support_whatsapp ?? ""} inputMode="tel" />
            <Input label="Delivery hours" name="delivery_hours" defaultValue={s.delivery_hours ?? ""} maxLength={200} />
            <Input label="Delivery fee (Rs)" name="delivery_fee" defaultValue={s.delivery_fee} inputMode="numeric" />
            <Input label="Minimum order (Rs)" name="min_order_amount" defaultValue={s.min_order_amount} inputMode="numeric" />
            <label className="flex flex-col gap-1 text-sm font-semibold md:col-span-2">
              Delivery areas
              <textarea name="delivery_areas" rows={2} maxLength={500} defaultValue={s.delivery_areas ?? ""} className={inputCls + " h-auto py-2"} />
            </label>
          </div>
        </ActionForm>
      </Card>

      <Card title="Payment accounts" className="scroll-mt-20">
        <div id="payments" />
        <p className="mb-3 text-sm text-muted-foreground">
          Customers see these after ordering. Leave a method empty to hide it at checkout. Customers send you a
          transaction ID (and optional screenshot) — never their PIN or password.
        </p>
        <ActionForm action={savePaymentAccounts} submit="Save payment accounts">
          <div className="grid gap-4 lg:grid-cols-3">
            <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
              <legend className="px-1 font-bold">JazzCash</legend>
              <Input label="JazzCash number" name="jazzcash_number" defaultValue={s.jazzcash_number ?? ""} inputMode="tel" />
              <Input label="Account name" name="jazzcash_account_name" defaultValue={s.jazzcash_account_name ?? ""} />
              <QrField name="jazzcash_qr_url" label="QR code" current={s.jazzcash_qr_url} />
            </fieldset>
            <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
              <legend className="px-1 font-bold">Easypaisa</legend>
              <Input label="Easypaisa number" name="easypaisa_number" defaultValue={s.easypaisa_number ?? ""} inputMode="tel" />
              <Input label="Account name" name="easypaisa_account_name" defaultValue={s.easypaisa_account_name ?? ""} />
              <QrField name="easypaisa_qr_url" label="QR code" current={s.easypaisa_qr_url} />
            </fieldset>
            <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
              <legend className="px-1 font-bold">Bank transfer</legend>
              <Input label="Bank name" name="bank_name" defaultValue={s.bank_name ?? ""} />
              <Input label="Account title" name="bank_account_title" defaultValue={s.bank_account_title ?? ""} />
              <Input label="Account number" name="bank_account_number" defaultValue={s.bank_account_number ?? ""} />
              <Input label="IBAN" name="bank_iban" defaultValue={s.bank_iban ?? ""} />
              <QrField name="bank_qr_url" label="QR code (optional)" current={s.bank_qr_url} />
            </fieldset>
          </div>
        </ActionForm>
      </Card>

      <Card title="Supplier shop (WhatsApp packing lists)">
        <ActionForm action={saveShop} submit="Save shop">
          {shop && <input type="hidden" name="id" value={shop.id} />}
          <div className="grid gap-3 md:grid-cols-3">
            <Input label="Shop name" name="name" required defaultValue={shop?.name ?? ""} />
            <Input
              label="Shop WhatsApp"
              name="whatsapp_phone"
              defaultValue={shop?.whatsapp_phone ?? ""}
              inputMode="tel"
              hint="e.g. 03001234567. This number gets the automatic supplier-price message for every new order."
            />
            <Input label="Address" name="address" defaultValue={shop?.address ?? ""} />
          </div>
        </ActionForm>
      </Card>

      <Card title="Order alerts (WhatsApp)">
        <p className="mb-3 text-sm text-muted-foreground">
          When a customer places an order, two messages are sent automatically. <b>You</b> get the customer, address,
          items, selling prices and total. The <b>shop</b> (number above) gets only product names, quantities and supplier
          prices. An order is always saved, even if WhatsApp fails; failed messages can be sent again.
        </p>
        <ActionForm action={saveNotificationSettings} submit="Save alerts">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Your (admin) WhatsApp"
              name="admin_whatsapp"
              defaultValue={alerts?.admin_whatsapp ?? ""}
              inputMode="tel"
              hint="e.g. 03001234567. Leave empty to use the number saved on the server."
            />
            <div className="flex items-end pb-2">
              <Check label="Send automatic order alerts" name="alerts_enabled" defaultChecked={alerts?.alerts_enabled ?? true} />
            </div>
          </div>
        </ActionForm>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
          <p className="text-sm">
            {failedAlerts ? (
              <span className="font-semibold text-destructive">{failedAlerts} message(s) failed to send.</span>
            ) : (
              <span className="text-muted-foreground">No failed messages.</span>
            )}
          </p>
          <ActionForm action={retryFailedNotifications} submit="Retry failed messages" inline />
        </div>
      </Card>

      <Card title="Admin login code (WhatsApp)">
        <p className="mb-3 text-sm text-muted-foreground">
          When this is ON, signing in to the admin needs the password <b>and</b> a 6-digit code that is sent to your admin
          WhatsApp number above. Even someone who knows the password cannot get in without your phone. Customers are not
          affected.
        </p>
        <p className="mb-3 text-sm font-semibold">
          Right now: {alerts?.require_login_code ? <span className="text-primary">ON</span> : <span>OFF</span>}
        </p>
        <ActionForm
          action={setLoginCodeCheck}
          submit={alerts?.require_login_code ? "Turn OFF the login code" : "Turn ON the login code"}
          confirm={
            alerts?.require_login_code
              ? "Turn off the WhatsApp login code?"
              : "Turn on the WhatsApp login code? Make sure your admin WhatsApp number is correct and order alerts reach you, or you will not be able to sign in."
          }
          danger={!!alerts?.require_login_code}
        >
          <input type="hidden" name="on" value={alerts?.require_login_code ? "false" : "true"} />
        </ActionForm>
        <p className="mt-3 text-xs text-muted-foreground">
          If WhatsApp ever stops working and you cannot sign in, run this in the Supabase SQL Editor to switch the code off:{" "}
          <code className="rounded bg-muted px-1">update public.notification_settings set require_login_code = false;</code>
        </p>
      </Card>
    </div>
  );
}
