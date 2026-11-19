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
