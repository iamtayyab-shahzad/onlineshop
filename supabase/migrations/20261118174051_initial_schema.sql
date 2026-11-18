-- Enums
create type public.user_role as enum ('customer', 'admin');
create type public.order_status as enum ('placed', 'confirmed', 'sent_to_shop', 'packed', 'out_for_delivery', 'delivered', 'cancelled');
create type public.payment_method as enum ('cod', 'jazzcash', 'bank_transfer');
create type public.payment_status as enum ('unpaid', 'pending_verification', 'paid', 'refunded');
create type public.payment_proof_status as enum ('submitted', 'verified', 'rejected');
create type public.voice_order_status as enum ('new', 'converted', 'rejected');

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone)
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Store settings (public, customer-safe values only)
create table public.store_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'Grocery Shop',
  delivery_fee numeric(10,2) not null default 0 check (delivery_fee >= 0),
  min_order_amount numeric(10,2) not null default 0 check (min_order_amount >= 0),
  support_phone text,
  support_whatsapp text,
  delivery_areas text,
  delivery_hours text,
  jazzcash_account_name text,
  jazzcash_number text,
  bank_name text,
  bank_account_title text,
  bank_account_number text,
  bank_iban text,
  updated_at timestamptz not null default now()
);
create trigger store_settings_updated_at before update on public.store_settings
  for each row execute function public.set_updated_at();

-- Shops (internal: who prepares the groceries)
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp_phone text,
  address text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index shops_one_default on public.shops (is_default) where is_default;

-- Catalog
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_urdu text,
  slug text not null unique,
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null,
  name_urdu text,
  slug text not null unique,
  unit_label text not null,
  description text,
  image_url text,
  selling_price numeric(10,2) not null check (selling_price >= 0),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_id_idx on public.products (category_id);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- Supplier prices live in their own admin-only table
create table public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  supplier_price numeric(10,2) not null check (supplier_price >= 0),
  updated_at timestamptz not null default now()
);
create trigger product_costs_updated_at before update on public.product_costs
  for each row execute function public.set_updated_at();

-- Addresses
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Home',
  recipient_name text not null,
  phone text not null,
  area text not null,
  address_line text not null,
  landmark text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_id_idx on public.addresses (user_id);
create trigger addresses_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();

-- Orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity (start with 1001) unique,
  user_id uuid not null references public.profiles (id) on delete restrict,
  status public.order_status not null default 'placed',
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'unpaid',
  delivery_name text not null,
  delivery_phone text not null,
  delivery_area text not null,
  delivery_address text not null,
  delivery_landmark text,
  customer_note text,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  delivery_fee numeric(10,2) not null default 0 check (delivery_fee >= 0),
  total numeric(10,2) not null check (total >= 0),
  source text not null default 'app' check (source in ('app', 'voice', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_id_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status);
create index orders_created_at_idx on public.orders (created_at desc);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  unit_label text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  line_total numeric(10,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

-- Supplier price snapshot per order line (admin-only)
create table public.order_item_costs (
  order_item_id uuid primary key references public.order_items (id) on delete cascade,
  supplier_unit_price numeric(10,2) not null check (supplier_unit_price >= 0),
  supplier_line_total numeric(10,2) not null check (supplier_line_total >= 0)
);

create table public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_status_events_order_id_idx on public.order_status_events (order_id);
create index order_status_events_created_by_idx on public.order_status_events (created_by);

-- Payment proofs (screenshots / transaction ids), verified manually by admin
create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  method public.payment_method not null check (method <> 'cod'),
  amount numeric(10,2) check (amount >= 0),
  transaction_ref text,
  screenshot_path text,
  status public.payment_proof_status not null default 'submitted',
  admin_note text,
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index payment_proofs_order_id_idx on public.payment_proofs (order_id);
create index payment_proofs_submitted_by_idx on public.payment_proofs (submitted_by);
create index payment_proofs_verified_by_idx on public.payment_proofs (verified_by);

-- Monthly list (one reusable list per customer)
create table public.monthly_list_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index monthly_list_items_product_id_idx on public.monthly_list_items (product_id);

-- Voice orders
create table public.voice_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  audio_path text not null,
  duration_seconds int,
  address_id uuid references public.addresses (id) on delete set null,
  customer_note text,
  status public.voice_order_status not null default 'new',
  order_id uuid references public.orders (id) on delete set null,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index voice_orders_user_id_idx on public.voice_orders (user_id);
create index voice_orders_address_id_idx on public.voice_orders (address_id);
create index voice_orders_order_id_idx on public.voice_orders (order_id);
create trigger voice_orders_updated_at before update on public.voice_orders
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.store_settings enable row level security;
alter table public.shops enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_costs enable row level security;
alter table public.order_status_events enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.monthly_list_items enable row level security;
alter table public.voice_orders enable row level security;

-- profiles: customers read/update their own name and phone; role is never client-writable
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone) on public.profiles to authenticated;

create policy "store_settings_read" on public.store_settings for select to anon, authenticated using (true);
create policy "store_settings_admin_update" on public.store_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "shops_admin_all" on public.shops for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "categories_read" on public.categories for select to anon, authenticated
  using (is_active or (select public.is_admin()));
create policy "categories_admin_insert" on public.categories for insert to authenticated
  with check ((select public.is_admin()));
create policy "categories_admin_update" on public.categories for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "categories_admin_delete" on public.categories for delete to authenticated
  using ((select public.is_admin()));

create policy "products_read" on public.products for select to anon, authenticated
  using (is_active or (select public.is_admin()));
create policy "products_admin_insert" on public.products for insert to authenticated
  with check ((select public.is_admin()));
create policy "products_admin_update" on public.products for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "products_admin_delete" on public.products for delete to authenticated
  using ((select public.is_admin()));

create policy "product_costs_admin_all" on public.product_costs for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "addresses_select" on public.addresses for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "addresses_insert_own" on public.addresses for insert to authenticated
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "addresses_update" on public.addresses for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "addresses_delete" on public.addresses for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- orders are created only through a server-side function; customers can only read their own
create policy "orders_select" on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "orders_admin_update" on public.orders for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "order_items_select" on public.order_items for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );
create policy "order_items_admin_write" on public.order_items for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "order_item_costs_admin_all" on public.order_item_costs for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "order_status_events_select" on public.order_status_events for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );
create policy "order_status_events_admin_insert" on public.order_status_events for insert to authenticated
  with check ((select public.is_admin()));

create policy "payment_proofs_select" on public.payment_proofs for select to authenticated
  using (submitted_by = (select auth.uid()) or (select public.is_admin()));
create policy "payment_proofs_insert_own" on public.payment_proofs for insert to authenticated
  with check (
    submitted_by = (select auth.uid())
    and status = 'submitted'
    and verified_by is null
    and verified_at is null
    and exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );
create policy "payment_proofs_admin_update" on public.payment_proofs for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "monthly_list_select" on public.monthly_list_items for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "monthly_list_insert" on public.monthly_list_items for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "monthly_list_update" on public.monthly_list_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "monthly_list_delete" on public.monthly_list_items for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "voice_orders_select" on public.voice_orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "voice_orders_insert_own" on public.voice_orders for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'new' and order_id is null);
create policy "voice_orders_admin_update" on public.voice_orders for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Storage buckets
insert into storage.buckets (id, name, public) values
  ('product-images', 'product-images', true),
  ('payment-proofs', 'payment-proofs', false),
  ('voice-orders', 'voice-orders', false);

create policy "product_images_admin_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "product_images_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
create policy "product_images_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));

create policy "private_uploads_insert_own" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('payment-proofs', 'voice-orders')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "private_uploads_select" on storage.objects for select to authenticated
  using (
    bucket_id in ('payment-proofs', 'voice-orders')
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );
