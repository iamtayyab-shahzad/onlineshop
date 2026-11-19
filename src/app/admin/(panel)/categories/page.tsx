import type { Metadata } from "next";
import { adminDb } from "@/lib/auth";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, Card, Check, Input } from "@/components/admin/admin-ui";
import { deleteCategory, saveCategory } from "@/app/admin/_actions/catalog";

export const metadata: Metadata = { title: "Categories" };

type Cat = { id: string; name: string; name_urdu: string | null; slug: string; icon: string | null; sort_order: number; is_active: boolean };

function Fields({ c }: { c?: Cat }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {c && <input type="hidden" name="id" value={c.id} />}
      <Input label="Name" name="name" required maxLength={60} defaultValue={c?.name} className="lg:col-span-2" />
      <Input label="Urdu name" name="name_urdu" maxLength={60} defaultValue={c?.name_urdu ?? ""} dir="auto" />
      <Input label="Icon (emoji)" name="icon" maxLength={8} defaultValue={c?.icon ?? ""} />
      <Input label="Sort" name="sort_order" inputMode="numeric" defaultValue={c?.sort_order ?? 0} />
      <Input label="Web name" name="slug" maxLength={60} defaultValue={c?.slug} />
      <Check label="Show in shop" name="is_active" defaultChecked={c?.is_active ?? true} />
    </div>
  );
}

export default async function CategoriesPage() {
  const { supabase } = await adminDb();
  const { data } = await supabase
    .from("categories")
    .select("id, name, name_urdu, slug, icon, sort_order, is_active, products(count)")
    .order("sort_order");
  return (
    <div className="flex flex-col gap-4">
      <AdminTitle title="Categories" />
      <Card title="Add category">
        <ActionForm action={saveCategory} submit="Add category">
          <Fields />
        </ActionForm>
      </Card>
      {data?.map((c) => (
        <Card key={c.id} title={`${c.icon ?? ""} ${c.name} · ${c.products?.[0]?.count ?? 0} products`}>
          <ActionForm action={saveCategory} submit="Save">
            <Fields c={c} />
          </ActionForm>
          <ActionForm
            action={deleteCategory}
            submit="Delete"
            danger
            className="mt-2"
            confirm={`Delete category “${c.name}”? Only possible when it has no products.`}
          >
            <input type="hidden" name="id" value={c.id} />
          </ActionForm>
        </Card>
      ))}
    </div>
  );
}
