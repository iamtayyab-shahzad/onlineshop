import type { Metadata } from "next";
import { adminDb } from "@/lib/auth";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, Card, Check, Input } from "@/components/admin/admin-ui";
import { deleteUnit, saveUnit } from "@/app/admin/_actions/catalog";

export const metadata: Metadata = { title: "Units" };

type Unit = { id: string; name: string; code: string; allow_decimal: boolean; is_active: boolean; sort_order: number };

function Fields({ u }: { u?: Unit }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {u && <input type="hidden" name="id" value={u.id} />}
      <Input label="Name" name="name" required maxLength={30} defaultValue={u?.name} hint="e.g. kg, dozen, packet" />
      <Input label="Code" name="code" maxLength={20} defaultValue={u?.code} hint="Short id; empty = from name" />
      <Input label="Sort" name="sort_order" inputMode="numeric" defaultValue={u?.sort_order ?? 0} />
      <Check label="Allow decimals (1.5)" name="allow_decimal" defaultChecked={u?.allow_decimal ?? false} />
      <Check label="Active" name="is_active" defaultChecked={u?.is_active ?? true} />
    </div>
  );
}

export default async function UnitsPage() {
  const { supabase } = await adminDb();
  const { data } = await supabase
    .from("units")
    .select("id, name, code, allow_decimal, is_active, sort_order, products(count)")
    .order("sort_order");
  return (
    <div className="flex flex-col gap-4">
      <AdminTitle title="Units" />
      <p className="text-sm text-muted-foreground">
        Decimals let customers buy 1.5 kg or 0.5 L. Whole-number units (piece, packet, dozen) only allow 1, 2, 3…
      </p>
      <Card title="Add unit">
        <ActionForm action={saveUnit} submit="Add unit">
          <Fields />
        </ActionForm>
      </Card>
      {data?.map((u) => (
        <Card key={u.id} title={`${u.name} · ${u.products?.[0]?.count ?? 0} products`}>
          <ActionForm action={saveUnit} submit="Save">
            <Fields u={u} />
          </ActionForm>
          <ActionForm
            action={deleteUnit}
            submit="Delete"
            danger
            className="mt-2"
            confirm={`Delete unit “${u.name}”? Only possible when no product uses it.`}
          >
            <input type="hidden" name="id" value={u.id} />
          </ActionForm>
        </Card>
      ))}
    </div>
  );
}
