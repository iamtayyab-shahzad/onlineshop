import type { Metadata } from "next";
import { adminDb } from "@/lib/auth";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, Card, Input, inputCls } from "@/components/admin/admin-ui";
import { QrField } from "@/components/admin/qr-field";
import { savePaymentAccounts, saveShop, saveStoreSettings } from "@/app/admin/_actions/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase } = await adminDb();
  const [{ data: s }, { data: shop }] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", true).single(),
    supabase.from("shops").select("id, name, whatsapp_phone, address").eq("is_default", true).maybeSingle(),
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
            <Input label="Shop WhatsApp" name="whatsapp_phone" defaultValue={shop?.whatsapp_phone ?? ""} inputMode="tel" hint="e.g. 03001234567" />
            <Input label="Address" name="address" defaultValue={shop?.address ?? ""} />
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
