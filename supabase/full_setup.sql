-- FULL SETUP for a NEW Supabase project. Paste into SQL Editor and click Run once.
-- Generated from supabase/migrations in filename order.

-- ===== 20261118174051_initial_schema.sql =====
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

-- ===== 20261118174124_seed_sample_catalog.sql =====
-- SAMPLE DATA: replace prices, phone numbers and shop details with real values before launch.
insert into public.store_settings (id, store_name, delivery_fee, min_order_amount, support_phone, support_whatsapp, delivery_areas, delivery_hours)
values (true, 'Grocery Shop', 150, 1000, '0300-0000000', '0300-0000000', 'Local area (to be confirmed)', '10:00 AM – 9:00 PM, every day');

insert into public.shops (name, whatsapp_phone, address, is_default)
values ('Partner Shop', '0300-0000000', 'To be confirmed', true);

insert into public.categories (name, name_urdu, slug, icon, sort_order) values
  ('Atta & Flour', 'آٹا', 'atta-flour', '🌾', 1),
  ('Rice', 'چاول', 'rice', '🍚', 2),
  ('Daal & Beans', 'دالیں', 'daal-beans', '🫘', 3),
  ('Oil & Ghee', 'تیل اور گھی', 'oil-ghee', '🫒', 4),
  ('Sugar, Salt & Basics', 'چینی اور نمک', 'sugar-salt-basics', '🧂', 5),
  ('Tea & Drinks', 'چائے', 'tea-drinks', '☕', 6),
  ('Spices & Masala', 'مصالحے', 'spices-masala', '🌶️', 7),
  ('Milk & Dairy', 'دودھ', 'milk-dairy', '🥛', 8),
  ('Snacks & Biscuits', 'بسکٹ', 'snacks-biscuits', '🍪', 9),
  ('Cleaning & Household', 'صفائی', 'cleaning-household', '🧼', 10),
  ('Personal Care', 'ذاتی نگہداشت', 'personal-care', '🧴', 11);

with p (cat, name, name_urdu, slug, unit, sell, cost, featured, sort) as (values
  ('atta-flour', 'Chakki Atta', 'چکی آٹا', 'chakki-atta-10kg', '10 kg bag', 1450, 1360, true, 1),
  ('atta-flour', 'Chakki Atta', 'چکی آٹا', 'chakki-atta-5kg', '5 kg bag', 750, 700, false, 2),
  ('atta-flour', 'Maida', 'میدہ', 'maida-1kg', '1 kg', 170, 150, false, 3),
  ('atta-flour', 'Besan', 'بیسن', 'besan-1kg', '1 kg', 320, 290, false, 4),
  ('rice', 'Basmati Rice', 'باسمتی چاول', 'basmati-rice-5kg', '5 kg', 1900, 1750, true, 1),
  ('rice', 'Basmati Rice', 'باسمتی چاول', 'basmati-rice-1kg', '1 kg', 400, 365, false, 2),
  ('rice', 'Sella Rice', 'سیلا چاول', 'sella-rice-5kg', '5 kg', 1750, 1600, false, 3),
  ('daal-beans', 'Daal Chana', 'دال چنا', 'daal-chana-1kg', '1 kg', 300, 270, true, 1),
  ('daal-beans', 'Daal Moong', 'دال مونگ', 'daal-moong-1kg', '1 kg', 360, 325, false, 2),
  ('daal-beans', 'Daal Masoor', 'دال مسور', 'daal-masoor-1kg', '1 kg', 330, 300, false, 3),
  ('daal-beans', 'Daal Mash', 'دال ماش', 'daal-mash-1kg', '1 kg', 520, 475, false, 4),
  ('daal-beans', 'Kala Chana', 'کالا چنا', 'kala-chana-1kg', '1 kg', 290, 260, false, 5),
  ('oil-ghee', 'Cooking Oil', 'کوکنگ آئل', 'cooking-oil-5l', '5 litre bottle', 2650, 2480, true, 1),
  ('oil-ghee', 'Cooking Oil', 'کوکنگ آئل', 'cooking-oil-1l', '1 litre pouch', 560, 520, false, 2),
  ('oil-ghee', 'Banaspati Ghee', 'بناسپتی گھی', 'banaspati-ghee-5kg', '5 kg tin', 2500, 2340, false, 3),
  ('oil-ghee', 'Banaspati Ghee', 'بناسپتی گھی', 'banaspati-ghee-1kg', '1 kg pouch', 530, 495, false, 4),
  ('sugar-salt-basics', 'Sugar', 'چینی', 'sugar-1kg', '1 kg', 165, 152, true, 1),
  ('sugar-salt-basics', 'Sugar', 'چینی', 'sugar-5kg', '5 kg', 810, 755, false, 2),
  ('sugar-salt-basics', 'Iodized Salt', 'نمک', 'salt-800g', '800 g', 60, 50, false, 3),
  ('sugar-salt-basics', 'Eggs', 'انڈے', 'eggs-dozen', '1 dozen', 330, 300, true, 4),
  ('tea-drinks', 'Black Tea (Loose)', 'پتی', 'black-tea-450g', '450 g pack', 850, 790, true, 1),
  ('tea-drinks', 'Black Tea (Loose)', 'پتی', 'black-tea-190g', '190 g pack', 380, 350, false, 2),
  ('tea-drinks', 'Green Tea Bags', 'سبز چائے', 'green-tea-30', '30 bags', 300, 270, false, 3),
  ('spices-masala', 'Red Chilli Powder', 'لال مرچ', 'red-chilli-200g', '200 g', 260, 235, false, 1),
  ('spices-masala', 'Haldi Powder', 'ہلدی', 'haldi-200g', '200 g', 180, 160, false, 2),
  ('spices-masala', 'Dhania Powder', 'دھنیا', 'dhania-200g', '200 g', 170, 150, false, 3),
  ('spices-masala', 'Garam Masala', 'گرم مصالحہ', 'garam-masala-100g', '100 g', 210, 190, false, 4),
  ('spices-masala', 'Biryani Masala', 'بریانی مصالحہ', 'biryani-masala-pack', '1 pack', 130, 115, false, 5),
  ('milk-dairy', 'Packed Milk', 'دودھ', 'packed-milk-1l', '1 litre', 290, 270, true, 1),
  ('milk-dairy', 'Yogurt', 'دہی', 'yogurt-1kg', '1 kg tub', 330, 300, false, 2),
  ('milk-dairy', 'Butter', 'مکھن', 'butter-200g', '200 g', 650, 600, false, 3),
  ('snacks-biscuits', 'Tea Biscuits', 'بسکٹ', 'tea-biscuits-family', 'Family pack', 220, 195, false, 1),
  ('snacks-biscuits', 'Rusk', 'رس', 'rusk-pack', '1 pack', 250, 225, false, 2),
  ('cleaning-household', 'Washing Powder', 'سرف', 'washing-powder-1kg', '1 kg', 520, 480, false, 1),
  ('cleaning-household', 'Dishwash Bar', 'برتن صابن', 'dishwash-bar', '1 bar', 110, 95, false, 2),
  ('cleaning-household', 'Floor Cleaner', 'فرش صاف کرنے والا', 'floor-cleaner-1l', '1 litre', 450, 410, false, 3),
  ('personal-care', 'Bath Soap', 'نہانے کا صابن', 'bath-soap', '1 bar', 150, 135, false, 1),
  ('personal-care', 'Toothpaste', 'ٹوتھ پیسٹ', 'toothpaste-100g', '100 g', 280, 255, false, 2),
  ('personal-care', 'Shampoo', 'شیمپو', 'shampoo-200ml', '200 ml', 520, 480, false, 3)
), ins as (
  insert into public.products (category_id, name, name_urdu, slug, unit_label, selling_price, is_featured, sort_order)
  select c.id, p.name, p.name_urdu, p.slug, p.unit, p.sell, p.featured, p.sort
  from p join public.categories c on c.slug = p.cat
  returning id, slug
)
insert into public.product_costs (product_id, supplier_price)
select ins.id, p.cost from ins join p on p.slug = ins.slug;

-- ===== 20261118174156_hide_internal_functions.sql =====
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- Policies reference functions by OID, so moving schemas keeps them working
alter function public.is_admin() set schema private;
alter function public.handle_new_user() set schema private;
alter function public.set_updated_at() set schema private;

revoke execute on function private.handle_new_user() from public, anon, authenticated;
revoke execute on function private.set_updated_at() from public, anon, authenticated;

-- ===== 20261118190000_checkout_and_addresses.sql =====
-- Stage 2: checkout, addresses and safe order creation.
-- Additive only: new columns, constraints, indexes and functions. No data is changed or removed.

-- 1. Sensible size limits on customer-entered text
alter table public.profiles
  add constraint profiles_full_name_len check (char_length(full_name) <= 80);

alter table public.addresses
  add constraint addresses_label_len check (char_length(label) between 1 and 30),
  add constraint addresses_recipient_len check (char_length(recipient_name) between 1 and 80),
  add constraint addresses_phone_len check (char_length(phone) between 7 and 20),
  add constraint addresses_area_len check (char_length(area) between 1 and 80),
  add constraint addresses_line_len check (char_length(address_line) between 1 and 300),
  add constraint addresses_landmark_len check (landmark is null or char_length(landmark) <= 150);

-- 2. At most one default address per customer
create unique index addresses_one_default_per_user on public.addresses (user_id) where is_default;

-- Make one address the default (runs as the caller, so RLS still applies)
create or replace function public.set_default_address(p_address_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.addresses where id = p_address_id and user_id = (select auth.uid())) then
    raise exception 'address_not_found';
  end if;
  update public.addresses set is_default = false where user_id = (select auth.uid()) and is_default;
  update public.addresses set is_default = true where id = p_address_id;
end;
$$;
revoke execute on function public.set_default_address(uuid) from public, anon;
grant execute on function public.set_default_address(uuid) to authenticated;

-- 3. Double-tap protection: the app sends a random id per checkout attempt
alter table public.orders add column client_request_id uuid;
create unique index orders_user_request_unique on public.orders (user_id, client_request_id)
  where client_request_id is not null;

-- 4. The ONLY way a customer can create an order.
--    The browser sends product ids + quantities; this function reads current
--    selling AND supplier prices itself, snapshots both, and computes totals.
create or replace function public.place_order(
  p_items jsonb,
  p_address_id uuid,
  p_payment_method public.payment_method,
  p_note text default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_addr public.addresses%rowtype;
  v_settings public.store_settings%rowtype;
  v_ids uuid[];
  v_qtys int[];
  v_found int;
  v_subtotal numeric(10,2);
  v_order_id uuid;
  v_order_number bigint;
  v_item_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  r record;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  -- Same checkout attempt submitted twice: return the order already created
  if p_request_id is not null then
    select o.id, o.order_number into v_order_id, v_order_number
    from public.orders o where o.user_id = v_uid and o.client_request_id = p_request_id;
    if found then
      return jsonb_build_object('id', v_order_id, 'order_number', v_order_number);
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'too_many_items';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'note_too_long';
  end if;

  select * into v_addr from public.addresses a where a.id = p_address_id and a.user_id = v_uid;
  if not found then
    raise exception 'address_not_found';
  end if;

  select * into v_settings from public.store_settings s where s.id;

  -- Merge duplicate lines; invalid ids or quantities raise an error
  select array_agg(x.product_id), array_agg(x.qty)
    into v_ids, v_qtys
  from (
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e
    group by 1
  ) x;

  if exists (select 1 from unnest(v_qtys) q where q is null or q < 1 or q > 50) then
    raise exception 'invalid_quantity';
  end if;

  select count(*), coalesce(sum(p.selling_price * q.qty), 0)
    into v_found, v_subtotal
  from unnest(v_ids, v_qtys) as q(product_id, qty)
  join public.products p on p.id = q.product_id and p.is_active;

  if v_found <> cardinality(v_ids) then
    raise exception 'item_unavailable';
  end if;
  if v_subtotal < v_settings.min_order_amount then
    raise exception 'below_minimum';
  end if;

  begin
    insert into public.orders (
      user_id, payment_method, delivery_name, delivery_phone, delivery_area, delivery_address,
      delivery_landmark, customer_note, subtotal, delivery_fee, total, source, client_request_id
    ) values (
      v_uid, p_payment_method, v_addr.recipient_name, v_addr.phone, v_addr.area, v_addr.address_line,
      v_addr.landmark, v_note, v_subtotal, v_settings.delivery_fee, v_subtotal + v_settings.delivery_fee,
      'app', p_request_id
    )
    returning id, order_number into v_order_id, v_order_number;
  exception when unique_violation then
    -- A simultaneous duplicate submit won the race; return that order
    select o.id, o.order_number into v_order_id, v_order_number
    from public.orders o where o.user_id = v_uid and o.client_request_id = p_request_id;
    return jsonb_build_object('id', v_order_id, 'order_number', v_order_number);
  end;

  for r in
    select p.id, p.name, p.unit_label, p.selling_price, coalesce(c.supplier_price, 0) as supplier_price, q.qty
    from unnest(v_ids, v_qtys) as q(product_id, qty)
    join public.products p on p.id = q.product_id
    left join public.product_costs c on c.product_id = p.id
    order by p.name
  loop
    insert into public.order_items (order_id, product_id, product_name, unit_label, unit_price, quantity, line_total)
    values (v_order_id, r.id, r.name, r.unit_label, r.selling_price, r.qty, r.selling_price * r.qty)
    returning id into v_item_id;

    insert into public.order_item_costs (order_item_id, supplier_unit_price, supplier_line_total)
    values (v_item_id, r.supplier_price, r.supplier_price * r.qty);
  end loop;

  insert into public.order_status_events (order_id, status, created_by)
  values (v_order_id, 'placed', v_uid);

  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number);
end;
$$;
revoke execute on function public.place_order(jsonb, uuid, public.payment_method, text, uuid) from public, anon;
grant execute on function public.place_order(jsonb, uuid, public.payment_method, text, uuid) to authenticated;

-- ===== 20261119100000_admin_units_images_payments.sql =====
-- Stage 3: admin-managed units, purchase methods (quantity / amount / both),
-- product image library, payment QR codes + Easypaisa, payment-proof and
-- voice-order limits, admin helper functions.
-- Everything here is additive; no existing data is removed.

-- 1. Units ------------------------------------------------------------------
create table public.units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]{1,20}$'),
  name text not null check (char_length(name) between 1 and 30),
  allow_decimal boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.units enable row level security;
create policy "units_read" on public.units for select to anon, authenticated using (true);
create policy "units_admin_insert" on public.units for insert to authenticated with check ((select private.is_admin()));
create policy "units_admin_update" on public.units for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "units_admin_delete" on public.units for delete to authenticated using ((select private.is_admin()));

insert into public.units (code, name, allow_decimal, sort_order) values
  ('kg', 'kg', true, 1),
  ('half_kg', 'half kg', false, 2),
  ('g', 'g', false, 3),
  ('litre', 'litre', true, 4),
  ('ml', 'ml', false, 5),
  ('piece', 'piece', false, 6),
  ('dozen', 'dozen', false, 7),
  ('packet', 'packet', false, 8),
  ('bottle', 'bottle', false, 9),
  ('bundle', 'bundle', false, 10),
  ('box', 'box', false, 11);

-- 2. Products: unit, purchase method, limits, stock ---------------------------
create type public.purchase_method as enum ('quantity', 'amount', 'both');

alter table public.products
  add column unit_id uuid references public.units (id) on delete restrict,
  add column purchase_method public.purchase_method not null default 'quantity',
  add column min_qty numeric(10,3) not null default 1 check (min_qty > 0),
  add column max_qty numeric(10,3) not null default 50,
  add column qty_step numeric(10,3) not null default 1 check (qty_step > 0),
  add column min_amount numeric(10,2) check (min_amount > 0),
  add column max_amount numeric(10,2),
  add column in_stock boolean not null default true,
  add constraint products_qty_range check (max_qty >= min_qty),
  add constraint products_amount_range check (max_amount is null or min_amount is null or max_amount >= min_amount),
  add constraint products_amount_needs_min check (purchase_method = 'quantity' or min_amount is not null),
  add constraint products_name_len check (char_length(name) between 1 and 120);

update public.products set unit_id = (select id from public.units where code = 'packet') where unit_id is null;
alter table public.products alter column unit_id set not null;
create index products_unit_id_idx on public.products (unit_id);

-- 3. Product image library (product_id null = uploaded but not yet assigned) --
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products (id) on delete set null,
  path text not null unique,
  original_name text not null,
  sha256 text not null unique,
  width int,
  height int,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_id_idx on public.product_images (product_id);
alter table public.product_images enable row level security;
create policy "product_images_read" on public.product_images for select to anon, authenticated
  using (product_id is not null or (select private.is_admin()));
create policy "product_images_admin_all" on public.product_images for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- 4. Order items: decimal quantities and amount-based lines --------------------
alter table public.order_items alter column quantity type numeric(10,3);
alter table public.order_items
  add column unit_name text,
  add column amount_requested numeric(10,2) check (amount_requested > 0);

-- 5. Payments: Easypaisa + QR codes ---------------------------------------
alter type public.payment_method add value if not exists 'easypaisa';
alter table public.store_settings
  add column easypaisa_number text,
  add column easypaisa_account_name text,
  add column jazzcash_qr_url text,
  add column easypaisa_qr_url text,
  add column bank_qr_url text;

alter table public.payment_proofs
  add constraint payment_proofs_ref_len check (transaction_ref is null or char_length(transaction_ref) <= 60);

-- A submitted proof moves the order to "pending verification" (customers
-- cannot update orders themselves).
create or replace function private.on_payment_proof_submitted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set payment_status = 'pending_verification'
  where id = new.order_id and payment_status = 'unpaid';
  return new;
end;
$$;
revoke execute on function private.on_payment_proof_submitted() from public, anon, authenticated;
create trigger payment_proofs_submitted after insert on public.payment_proofs
  for each row execute function private.on_payment_proof_submitted();

-- 6. Voice orders: sane limits ------------------------------------------------
alter table public.voice_orders
  add constraint voice_orders_note_len check (customer_note is null or char_length(customer_note) <= 500),
  add constraint voice_orders_duration check (duration_seconds is null or duration_seconds between 0 and 600);

-- 7. Storage limits per bucket ------------------------------------------------
update storage.buckets set file_size_limit = 3145728,
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
  where id = 'product-images';
update storage.buckets set file_size_limit = 5242880,
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
  where id = 'payment-proofs';
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a', 'audio/wav']
  where id = 'voice-orders';

-- 8. place_order v2: quantity OR amount per line ------------------------------
create or replace function public.place_order(
  p_items jsonb,
  p_address_id uuid,
  p_payment_method public.payment_method,
  p_note text default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_addr public.addresses%rowtype;
  v_settings public.store_settings%rowtype;
  v_subtotal numeric(12,2) := 0;
  v_order_id uuid;
  v_order_number bigint;
  v_item_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_lines jsonb := '[]'::jsonb;
  v_qty numeric(10,3);
  v_amt numeric(10,2);
  v_line numeric(12,2);
  e jsonb;
  p record;
  l jsonb;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  if p_request_id is not null then
    select o.id, o.order_number into v_order_id, v_order_number
    from public.orders o where o.user_id = v_uid and o.client_request_id = p_request_id;
    if found then
      return jsonb_build_object('id', v_order_id, 'order_number', v_order_number);
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'too_many_items';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'note_too_long';
  end if;
  if (select count(*) <> count(distinct x ->> 'product_id') from jsonb_array_elements(p_items) x) then
    raise exception 'duplicate_item';
  end if;

  select * into v_addr from public.addresses a where a.id = p_address_id and a.user_id = v_uid;
  if not found then
    raise exception 'address_not_found';
  end if;

  select * into v_settings from public.store_settings s where s.id;
  if (p_payment_method = 'jazzcash' and v_settings.jazzcash_number is null)
     or (p_payment_method = 'easypaisa' and v_settings.easypaisa_number is null)
     or (p_payment_method = 'bank_transfer' and v_settings.bank_account_number is null and v_settings.bank_iban is null) then
    raise exception 'payment_method_unavailable';
  end if;

  -- Pass 1: validate every line and compute exact amounts (numeric, no floats)
  for e in select value from jsonb_array_elements(p_items) loop
    select pr.id, pr.name, pr.unit_label, pr.selling_price, pr.purchase_method, pr.min_qty, pr.max_qty,
           pr.qty_step, pr.min_amount, pr.max_amount, u.name as unit_name, u.allow_decimal,
           coalesce(c.supplier_price, 0) as supplier_price
      into p
    from public.products pr
    join public.units u on u.id = pr.unit_id
    left join public.product_costs c on c.product_id = pr.id
    where pr.id = (e ->> 'product_id')::uuid and pr.is_active and pr.in_stock;
    if not found or p.selling_price <= 0 then
      raise exception 'item_unavailable';
    end if;

    if e ? 'amount' and jsonb_typeof(e -> 'amount') = 'number' then
      if p.purchase_method = 'quantity' then
        raise exception 'invalid_amount';
      end if;
      v_amt := (e ->> 'amount')::numeric;
      if v_amt <> round(v_amt, 0) or v_amt < p.min_amount or (p.max_amount is not null and v_amt > p.max_amount) then
        raise exception 'invalid_amount';
      end if;
      v_qty := round(v_amt / p.selling_price, 3);
      if v_qty <= 0 then
        raise exception 'invalid_amount';
      end if;
      v_line := v_amt;
    else
      if p.purchase_method = 'amount' then
        raise exception 'invalid_quantity';
      end if;
      v_qty := (e ->> 'quantity')::numeric;
      v_amt := null;
      if v_qty is null or v_qty < p.min_qty or v_qty > p.max_qty or mod(v_qty, p.qty_step) <> 0
         or (not p.allow_decimal and v_qty <> trunc(v_qty)) then
        raise exception 'invalid_quantity';
      end if;
      v_line := round(p.selling_price * v_qty, 2);
    end if;

    v_subtotal := v_subtotal + v_line;
    v_lines := v_lines || jsonb_build_object(
      'product_id', p.id, 'name', p.name, 'unit_label', p.unit_label, 'unit_name', p.unit_name,
      'price', p.selling_price, 'qty', v_qty, 'amount', v_amt, 'line', v_line,
      'supplier_price', p.supplier_price, 'supplier_line', round(p.supplier_price * v_qty, 2));
  end loop;

  if v_subtotal < v_settings.min_order_amount then
    raise exception 'below_minimum';
  end if;

  begin
    insert into public.orders (
      user_id, payment_method, delivery_name, delivery_phone, delivery_area, delivery_address,
      delivery_landmark, customer_note, subtotal, delivery_fee, total, source, client_request_id
    ) values (
      v_uid, p_payment_method, v_addr.recipient_name, v_addr.phone, v_addr.area, v_addr.address_line,
      v_addr.landmark, v_note, v_subtotal, v_settings.delivery_fee, v_subtotal + v_settings.delivery_fee,
      'app', p_request_id
    )
    returning id, order_number into v_order_id, v_order_number;
  exception when unique_violation then
    select o.id, o.order_number into v_order_id, v_order_number
    from public.orders o where o.user_id = v_uid and o.client_request_id = p_request_id;
    return jsonb_build_object('id', v_order_id, 'order_number', v_order_number);
  end;

  -- Pass 2: snapshot names, units, selling AND supplier prices
  for l in select value from jsonb_array_elements(v_lines) loop
    insert into public.order_items (order_id, product_id, product_name, unit_label, unit_name, unit_price,
                                    quantity, amount_requested, line_total)
    values (v_order_id, (l ->> 'product_id')::uuid, l ->> 'name', l ->> 'unit_label', l ->> 'unit_name',
            (l ->> 'price')::numeric, (l ->> 'qty')::numeric, (l ->> 'amount')::numeric, (l ->> 'line')::numeric)
    returning id into v_item_id;

    insert into public.order_item_costs (order_item_id, supplier_unit_price, supplier_line_total)
    values (v_item_id, (l ->> 'supplier_price')::numeric, (l ->> 'supplier_line')::numeric);
  end loop;

  insert into public.order_status_events (order_id, status, created_by)
  values (v_order_id, 'placed', v_uid);

  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number);
end;
$$;

-- 9. Admin helpers (SECURITY INVOKER: RLS still applies; explicit admin check too)
create or replace function public.admin_set_order_status(p_order_id uuid, p_status public.order_status, p_note text default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not (select private.is_admin()) then
    raise exception 'not_admin';
  end if;
  update public.orders set status = p_status where id = p_order_id;
  if not found then
    raise exception 'order_not_found';
  end if;
  insert into public.order_status_events (order_id, status, note, created_by)
  values (p_order_id, p_status, nullif(btrim(coalesce(p_note, '')), ''), (select auth.uid()));
end;
$$;
revoke execute on function public.admin_set_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, public.order_status, text) to authenticated;

create or replace function public.admin_sales_report(p_from date, p_to date)
returns table (day date, orders bigint, sales numeric, supplier_cost numeric, profit numeric)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not (select private.is_admin()) then
    raise exception 'not_admin';
  end if;
  return query
  select (o.created_at at time zone 'Asia/Karachi')::date as day,
         count(distinct o.id) as orders,
         coalesce(sum(oi.line_total), 0) as sales,
         coalesce(sum(c.supplier_line_total), 0) as supplier_cost,
         coalesce(sum(oi.line_total), 0) - coalesce(sum(c.supplier_line_total), 0) as profit
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  left join public.order_item_costs c on c.order_item_id = oi.id
  where o.status <> 'cancelled'
    and (o.created_at at time zone 'Asia/Karachi')::date between p_from and p_to
  group by 1
  order by 1 desc;
end;
$$;
revoke execute on function public.admin_sales_report(date, date) from public, anon;
grant execute on function public.admin_sales_report(date, date) to authenticated;

-- ===== 20261120090000_monthly_list_decimals.sql =====
-- Monthly list: allow decimal quantities (1.5 kg) and "Rs X worth" lines, like the cart.
-- The table was empty when this ran; widening int -> numeric loses nothing.
alter table public.monthly_list_items
  alter column quantity type numeric(10,3) using quantity::numeric,
  add column if not exists amount integer check (amount is null or amount > 0);

-- ===== 20261120100000_table_grants.sql =====
-- Explicit table access for the Data API. New Supabase projects no longer grant this
-- automatically. Row Level Security (the policies in earlier migrations) still decides
-- WHICH rows each person may see or change; these grants only let the policies run.
-- Visitors who are not signed in may only READ the public catalog.
-- profiles: customers may read, and may update only full_name and phone (column grant in the initial migration),
-- so nobody can change their own role.

grant select on public.categories, public.products, public.units, public.product_images, public.store_settings to anon;

grant select, insert, update, delete on
  public.categories, public.products, public.units, public.product_images,
  public.shops, public.product_costs, public.order_item_costs, public.order_items,
  public.addresses, public.monthly_list_items
  to authenticated;

grant select, update on public.orders, public.store_settings to authenticated;
grant select, insert on public.order_status_events to authenticated;
grant select, insert, update on public.payment_proofs, public.voice_orders to authenticated;
grant select on public.profiles to authenticated;

-- ===== 20261121090000_whatsapp_notifications.sql =====
-- Automatic WhatsApp order alerts (sent by the server through WAHA).
--
-- * `order_notifications` keeps one row per order per recipient (admin, shop) with its status,
--   so a message is never sent twice and a failed one can be retried.
-- * A trigger queues both rows the moment an order is saved. Placing an order never depends on WhatsApp.
-- * Supplier prices are admin-only. The message text is built here, in the database, and only
--   handed to a server that knows NOTIFY_SECRET (its hash is stored in notification_settings).
--   A customer's own login token cannot call these functions successfully.
-- * The shop's number is the existing shops.whatsapp_phone (Admin -> Settings -> Supplier shop).

-- Settings (single row, admin only). The secret hash is set once in the SQL Editor and is never readable through the API.
create table public.notification_settings (
  id boolean primary key default true check (id),
  alerts_enabled boolean not null default true,
  admin_whatsapp text check (admin_whatsapp is null or char_length(admin_whatsapp) between 7 and 20),
  secret_hash text,
  updated_at timestamptz not null default now()
);
insert into public.notification_settings (id) values (true) on conflict do nothing;
create trigger notification_settings_updated_at before update on public.notification_settings
  for each row execute function private.set_updated_at();

create table public.order_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  recipient text not null check (recipient in ('admin', 'shop')),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, recipient)
);
create index order_notifications_status_idx on public.order_notifications (status);
create trigger order_notifications_updated_at before update on public.order_notifications
  for each row execute function private.set_updated_at();

alter table public.notification_settings enable row level security;
alter table public.order_notifications enable row level security;

create policy "notification_settings_admin_select" on public.notification_settings for select to authenticated
  using ((select private.is_admin()));
create policy "notification_settings_admin_update" on public.notification_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "order_notifications_admin_select" on public.order_notifications for select to authenticated
  using ((select private.is_admin()));

-- Column-level access: the admin can read and change the number and the on/off switch, never the secret hash.
-- (Revoke first: some projects hand out table-wide access by default, which would override the column list.)
revoke all on public.notification_settings, public.order_notifications from anon, authenticated;
grant select (id, alerts_enabled, admin_whatsapp, updated_at) on public.notification_settings to authenticated;
grant update (alerts_enabled, admin_whatsapp) on public.notification_settings to authenticated;
grant select on public.order_notifications to authenticated;

-- Queue one alert per recipient for every new order.
create or replace function private.queue_order_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select alerts_enabled from public.notification_settings where id), false) then
    insert into public.order_notifications (order_id, recipient)
    values (new.id, 'admin'), (new.id, 'shop')
    on conflict (order_id, recipient) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function private.queue_order_notifications() from public, anon, authenticated;
create trigger orders_queue_notifications after insert on public.orders
  for each row execute function private.queue_order_notifications();

-- Checks the caller knows the server secret.
create or replace function private.notify_secret_ok(p_secret text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select s.secret_hash is not null
            and p_secret is not null
            and p_secret <> ''
            and s.secret_hash = encode(sha256(convert_to(p_secret, 'utf8')), 'hex')
       from public.notification_settings s where s.id),
    false);
$$;
revoke execute on function private.notify_secret_ok(text) from public, anon, authenticated;

-- Takes the message for ONE recipient. Returns null when there is nothing to send
-- (already sent, or another request is sending it right now), so a message cannot go out twice.
-- admin payload: customer details + selling prices. shop payload: product names, quantities and
-- supplier prices only. The two never mix.
create or replace function public.claim_order_notification(
  p_order_id uuid, p_recipient text, p_secret text, p_force boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_claimed public.order_notifications;
  v_o public.orders;
  v_to text;
  v_payload jsonb;
begin
  if not private.notify_secret_ok(p_secret) then
    raise exception 'not_allowed';
  end if;
  if p_recipient not in ('admin', 'shop') then
    raise exception 'bad_recipient';
  end if;

  update public.order_notifications n
     set status = 'sending', claimed_at = now(), attempts = n.attempts + 1
   where n.order_id = p_order_id and n.recipient = p_recipient
     and (n.status <> 'sending' or n.claimed_at < now() - interval '2 minutes')
     and (p_force or n.status <> 'sent')
  returning * into v_claimed;
  if not found then
    return null;
  end if;

  select * into v_o from public.orders where id = p_order_id;
  if p_recipient = 'admin' then
    select admin_whatsapp into v_to from public.notification_settings where id;
    v_payload := jsonb_build_object(
      'order_number', v_o.order_number,
      'placed_at', v_o.created_at,
      'customer_name', v_o.delivery_name,
      'customer_phone', v_o.delivery_phone,
      'area', v_o.delivery_area,
      'address', v_o.delivery_address,
      'landmark', v_o.delivery_landmark,
      'note', v_o.customer_note,
      'payment_method', v_o.payment_method,
      'subtotal', v_o.subtotal,
      'delivery_fee', v_o.delivery_fee,
      'total', v_o.total,
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'name', oi.product_name,
                 'qty', oi.quantity,
                 'unit', coalesce(oi.unit_name, oi.unit_label),
                 'amount_requested', oi.amount_requested,
                 'unit_price', oi.unit_price,
                 'line_total', oi.line_total) order by oi.created_at, oi.id), '[]'::jsonb)
          from public.order_items oi where oi.order_id = p_order_id)
    );
  else
    select s.whatsapp_phone into v_to from public.shops s where s.is_default limit 1;
    v_payload := jsonb_build_object(
      'order_number', v_o.order_number,
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'name', oi.product_name,
                 'qty', oi.quantity,
                 'unit', coalesce(oi.unit_name, oi.unit_label),
                 'amount_requested', oi.amount_requested,
                 'supplier_unit_price', c.supplier_unit_price,
                 'supplier_line_total', c.supplier_line_total) order by oi.created_at, oi.id), '[]'::jsonb)
          from public.order_items oi
          left join public.order_item_costs c on c.order_item_id = oi.id
         where oi.order_id = p_order_id),
      'supplier_total', (
        select coalesce(sum(c.supplier_line_total), 0)
          from public.order_items oi
          join public.order_item_costs c on c.order_item_id = oi.id
         where oi.order_id = p_order_id),
      'missing_prices', (
        select count(*) from public.order_items oi
          left join public.order_item_costs c on c.order_item_id = oi.id
         where oi.order_id = p_order_id and c.order_item_id is null)
    );
  end if;
  return jsonb_build_object('to', v_to, 'payload', v_payload);
end;
$$;
revoke execute on function public.claim_order_notification(uuid, text, text, boolean) from public, anon;
grant execute on function public.claim_order_notification(uuid, text, text, boolean) to authenticated;

-- Records what happened after the server tried to send.
create or replace function public.record_order_notification(
  p_order_id uuid, p_recipient text, p_secret text, p_ok boolean, p_error text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.notify_secret_ok(p_secret) then
    raise exception 'not_allowed';
  end if;
  update public.order_notifications
     set status = case when p_ok then 'sent' else 'failed' end,
         last_error = case when p_ok then null else left(coalesce(p_error, 'Unknown error'), 300) end,
         sent_at = case when p_ok then now() else sent_at end,
         claimed_at = null
   where order_id = p_order_id and recipient = p_recipient and status = 'sending';
end;
$$;
revoke execute on function public.record_order_notification(uuid, text, text, boolean, text) from public, anon;
grant execute on function public.record_order_notification(uuid, text, text, boolean, text) to authenticated;
