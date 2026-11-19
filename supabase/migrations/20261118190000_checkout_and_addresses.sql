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
