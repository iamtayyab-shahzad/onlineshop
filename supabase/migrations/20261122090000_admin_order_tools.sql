-- Admin order tools
--
--  1. Three order stages only: New (placed), Delivered, Cancelled. Older in-between stages are folded into "New".
--  2. Orders get an extra `discount`. The admin can edit an order (add / remove items, change prices and
--     quantities, change the delivery fee, give a discount) and create an order from a voice message.
--  3. Optional WhatsApp login code for the admin. It is enforced INSIDE the database: while it is switched on,
--     a password-only session is not treated as admin by any policy or function until the code from WhatsApp
--     has been entered for that exact login session. It is OFF by default; turn it on in Admin -> Settings.
--
-- To switch the login code off by hand (for example if WhatsApp is down), run in the SQL Editor:
--   update public.notification_settings set require_login_code = false;

-- ---------------------------------------------------------------------------
-- 1. Three stages
-- ---------------------------------------------------------------------------
update public.orders
   set status = 'placed'
 where status in ('confirmed', 'sent_to_shop', 'packed', 'out_for_delivery');

create or replace function public.admin_set_order_status(p_order_id uuid, p_status public.order_status, p_note text default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not (select private.is_admin()) then
    raise exception 'not_admin';
  end if;
  if p_status not in ('placed', 'delivered', 'cancelled') then
    raise exception 'status_not_allowed';
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

-- ---------------------------------------------------------------------------
-- 2. Discount, edit order, create order from a voice message
-- ---------------------------------------------------------------------------
alter table public.orders
  add column discount numeric(10,2) not null default 0 check (discount >= 0);

-- Writes the lines of an order (used by the two admin functions below). Lines that carry an `id` are updated,
-- lines without one are added, and existing lines that are not listed are removed.
-- A line: { id?, product_id?, name?, unit_label?, unit_price, quantity }. Returns the new items total.
create or replace function private.apply_order_items(p_order_id uuid, p_items jsonb)
returns numeric language plpgsql security definer set search_path = '' as $$
declare
  e jsonb;
  v_subtotal numeric(12,2) := 0;
  v_keep uuid[] := '{}';
  v_id uuid;
  v_pid uuid;
  v_price numeric;
  v_qty numeric;
  v_line numeric(12,2);
  v_name text;
  v_label text;
  v_unit text;
  v_sup numeric;
  p record;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_items';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'too_many_items';
  end if;

  for e in select value from jsonb_array_elements(p_items) loop
    v_price := round((e ->> 'unit_price')::numeric, 2);
    v_qty := round((e ->> 'quantity')::numeric, 3);
    if v_price is null or v_price < 0 or v_price > 1000000 then
      raise exception 'invalid_price';
    end if;
    if v_qty is null or v_qty <= 0 or v_qty > 100000 then
      raise exception 'invalid_quantity';
    end if;
    v_line := round(v_price * v_qty, 2);
    v_id := nullif(e ->> 'id', '')::uuid;

    if v_id is not null then
      perform 1 from public.order_items oi where oi.id = v_id and oi.order_id = p_order_id;
      if not found then
        raise exception 'item_not_found';
      end if;
      update public.order_items
         set unit_price = v_price, quantity = v_qty, line_total = v_line, amount_requested = null
       where id = v_id;
      update public.order_item_costs
         set supplier_line_total = round(supplier_unit_price * v_qty, 2)
       where order_item_id = v_id;
    else
      v_pid := nullif(e ->> 'product_id', '')::uuid;
      if v_pid is not null then
        select pr.name, pr.unit_label, u.name as unit_name, coalesce(c.supplier_price, 0) as supplier_price
          into p
          from public.products pr
          join public.units u on u.id = pr.unit_id
          left join public.product_costs c on c.product_id = pr.id
         where pr.id = v_pid;
        if not found then
          raise exception 'item_unavailable';
        end if;
        v_name := p.name;
        v_label := p.unit_label;
        v_unit := p.unit_name;
        v_sup := p.supplier_price;
      else
        v_name := nullif(btrim(coalesce(e ->> 'name', '')), '');
        if v_name is null or char_length(v_name) > 120 then
          raise exception 'invalid_name';
        end if;
        v_label := coalesce(nullif(btrim(coalesce(e ->> 'unit_label', '')), ''), 'each');
        v_label := left(v_label, 40);
        v_unit := null;
        v_sup := null;
      end if;
      insert into public.order_items (order_id, product_id, product_name, unit_label, unit_name, unit_price, quantity, line_total)
      values (p_order_id, v_pid, v_name, v_label, v_unit, v_price, v_qty, v_line)
      returning id into v_id;
      if v_sup is not null then
        insert into public.order_item_costs (order_item_id, supplier_unit_price, supplier_line_total)
        values (v_id, v_sup, round(v_sup * v_qty, 2));
      end if;
    end if;

    v_keep := v_keep || v_id;
    v_subtotal := v_subtotal + v_line;
  end loop;

  delete from public.order_items where order_id = p_order_id and id <> all (v_keep);
  return v_subtotal;
end;
$$;
revoke execute on function private.apply_order_items(uuid, jsonb) from public, anon, authenticated;

create or replace function public.admin_update_order(
  p_order_id uuid,
  p_items jsonb,
  p_discount numeric default 0,
  p_delivery_fee numeric default null,
  p_note text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_o public.orders;
  v_sub numeric(12,2);
  v_fee numeric(10,2);
  v_disc numeric(10,2);
begin
  if not (select private.is_admin()) then
    raise exception 'not_admin';
  end if;
  select * into v_o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  v_fee := round(coalesce(p_delivery_fee, v_o.delivery_fee), 2);
  v_disc := round(coalesce(p_discount, 0), 2);
  if v_fee < 0 or v_fee > 100000 then
    raise exception 'invalid_fee';
  end if;
  if v_disc < 0 then
    raise exception 'invalid_discount';
  end if;

  v_sub := private.apply_order_items(p_order_id, p_items);
  if v_disc > v_sub + v_fee then
    raise exception 'discount_too_big';
  end if;

  update public.orders
     set subtotal = v_sub, delivery_fee = v_fee, discount = v_disc, total = v_sub + v_fee - v_disc
   where id = p_order_id;

  insert into public.order_status_events (order_id, status, note, created_by)
  values (p_order_id, v_o.status, coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Order edited by admin'), (select auth.uid()));

  return jsonb_build_object('subtotal', v_sub, 'delivery_fee', v_fee, 'discount', v_disc, 'total', v_sub + v_fee - v_disc);
end;
$$;
revoke execute on function public.admin_update_order(uuid, jsonb, numeric, numeric, text) from public, anon;
grant execute on function public.admin_update_order(uuid, jsonb, numeric, numeric, text) to authenticated;

-- Creates a normal order for the customer who sent a voice message and marks the voice message as converted.
-- Safe to call twice: a voice message that already has an order just returns that order.
create or replace function public.admin_create_order(
  p_voice_order_id uuid,
  p_items jsonb,
  p_address_id uuid default null,
  p_payment_method public.payment_method default 'cod',
  p_discount numeric default 0,
  p_delivery_fee numeric default null,
  p_note text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_v public.voice_orders;
  v_addr public.addresses;
  v_prof public.profiles;
  v_fee numeric(10,2);
  v_disc numeric(10,2);
  v_sub numeric(12,2);
  v_note text;
  v_name text;
  v_phone text;
  v_area text;
  v_address text;
  v_landmark text;
  v_order_id uuid;
  v_order_number bigint;
begin
  if not (select private.is_admin()) then
    raise exception 'not_admin';
  end if;
  select * into v_v from public.voice_orders where id = p_voice_order_id for update;
  if not found then
    raise exception 'voice_order_not_found';
  end if;
  if v_v.order_id is not null then
    select o.id, o.order_number into v_order_id, v_order_number from public.orders o where o.id = v_v.order_id;
    if found then
      return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'already', true);
    end if;
  end if;

  select * into v_prof from public.profiles where id = v_v.user_id;
  select * into v_addr from public.addresses
   where user_id = v_v.user_id and id = coalesce(p_address_id, v_v.address_id);
  if not found then
    select * into v_addr from public.addresses
     where user_id = v_v.user_id order by is_default desc, created_at desc limit 1;
  end if;
  if found then
    v_name := v_addr.recipient_name; v_phone := v_addr.phone; v_area := v_addr.area;
    v_address := v_addr.address_line; v_landmark := v_addr.landmark;
  else
    v_name := coalesce(nullif(btrim(v_prof.full_name), ''), 'Customer');
    v_phone := coalesce(nullif(btrim(v_prof.phone), ''), '-');
    v_area := 'To confirm';
    v_address := 'To confirm with the customer';
    v_landmark := null;
  end if;

  v_fee := round(coalesce(p_delivery_fee, (select s.delivery_fee from public.store_settings s where s.id), 0), 2);
  v_disc := round(coalesce(p_discount, 0), 2);
  if v_fee < 0 or v_fee > 100000 then
    raise exception 'invalid_fee';
  end if;
  if v_disc < 0 then
    raise exception 'invalid_discount';
  end if;
  v_note := nullif(btrim(coalesce(p_note, v_v.customer_note, '')), '');
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'note_too_long';
  end if;

  insert into public.orders (
    user_id, payment_method, delivery_name, delivery_phone, delivery_area, delivery_address,
    delivery_landmark, customer_note, subtotal, delivery_fee, discount, total, source, client_request_id
  ) values (
    v_v.user_id, p_payment_method, v_name, v_phone, v_area, v_address,
    v_landmark, v_note, 0, v_fee, 0, 0, 'voice', p_voice_order_id
  ) returning id, order_number into v_order_id, v_order_number;

  v_sub := private.apply_order_items(v_order_id, p_items);
  if v_disc > v_sub + v_fee then
    raise exception 'discount_too_big';
  end if;
  update public.orders
     set subtotal = v_sub, discount = v_disc, total = v_sub + v_fee - v_disc
   where id = v_order_id;

  insert into public.order_status_events (order_id, status, note, created_by)
  values (v_order_id, 'placed', 'Created by admin from a voice message', (select auth.uid()));

  update public.voice_orders set status = 'converted', order_id = v_order_id where id = p_voice_order_id;

  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'already', false);
end;
$$;
revoke execute on function public.admin_create_order(uuid, jsonb, uuid, public.payment_method, numeric, numeric, text) from public, anon;
grant execute on function public.admin_create_order(uuid, jsonb, uuid, public.payment_method, numeric, numeric, text) to authenticated;

-- Sales figures count the discount (delivery fee is not part of sales, as before).
create or replace function public.admin_sales_report(p_from date, p_to date)
returns table (day date, orders bigint, sales numeric, supplier_cost numeric, profit numeric)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not (select private.is_admin()) then
    raise exception 'not_admin';
  end if;
  return query
  select t.d,
         count(*)::bigint,
         coalesce(sum(t.sales), 0),
         coalesce(sum(t.cost), 0),
         coalesce(sum(t.sales - t.cost), 0)
  from (
    select (o.created_at at time zone 'Asia/Karachi')::date as d,
           coalesce((select sum(oi.line_total) from public.order_items oi where oi.order_id = o.id), 0) - o.discount as sales,
           coalesce((select sum(c.supplier_line_total)
                       from public.order_items oi
                       join public.order_item_costs c on c.order_item_id = oi.id
                      where oi.order_id = o.id), 0) as cost
    from public.orders o
    where o.status <> 'cancelled'
      and (o.created_at at time zone 'Asia/Karachi')::date between p_from and p_to
  ) t
  group by 1
  order by 1 desc;
end;
$$;
revoke execute on function public.admin_sales_report(date, date) from public, anon;
grant execute on function public.admin_sales_report(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. WhatsApp login code for the admin (enforced in the database)
-- ---------------------------------------------------------------------------
alter table public.notification_settings
  add column require_login_code boolean not null default false;
grant select (require_login_code) on public.notification_settings to authenticated;
-- (no UPDATE grant: the switch is changed only through admin_set_login_check below)

create table private.admin_login_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_count int not null default 1,
  window_start timestamptz not null default now(),
  last_sent_at timestamptz not null default now()
);
create table private.admin_verified_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  verified_at timestamptz not null default now()
);
alter table private.admin_login_codes enable row level security;
alter table private.admin_verified_sessions enable row level security;
revoke all on private.admin_login_codes, private.admin_verified_sessions from public, anon, authenticated;

-- The plain role check (what is_admin() used to be).
create or replace function private.is_admin_role()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke execute on function private.is_admin_role() from public, anon;
grant execute on function private.is_admin_role() to authenticated;

-- Every policy and admin function asks this. With the login code switched on, being an admin is not
-- enough: this exact login session must also have entered the WhatsApp code.
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
  and (
    not coalesce((select s.require_login_code from public.notification_settings s where s.id), false)
    or exists (
      select 1 from private.admin_verified_sessions v
      where v.user_id = (select auth.uid())
        and v.session_id::text = ((select auth.jwt()) ->> 'session_id')
        and v.verified_at > now() - interval '30 days'
    )
  );
$$;

-- What the app needs to decide where to send an admin: not an admin / needs the code / fine.
create or replace function public.admin_gate_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_admin boolean := private.is_admin_role();
  v_required boolean := false;
  v_verified boolean := false;
begin
  if not v_admin then
    return jsonb_build_object('admin', false, 'required', false, 'verified', false);
  end if;
  v_required := coalesce((select s.require_login_code from public.notification_settings s where s.id), false);
  v_verified := (not v_required) or private.is_admin();
  return jsonb_build_object('admin', true, 'required', v_required, 'verified', v_verified);
end;
$$;
revoke execute on function public.admin_gate_status() from public, anon;
grant execute on function public.admin_gate_status() to authenticated;

-- The server (which knows NOTIFY_SECRET) stores the code it just generated and is told where to send it.
-- A password-only session cannot call this successfully: it does not know the secret.
create or replace function public.admin_store_login_code(p_secret text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_to text;
  v_row private.admin_login_codes;
begin
  if not private.is_admin_role() then
    raise exception 'not_admin';
  end if;
  if not private.notify_secret_ok(p_secret) then
    raise exception 'not_allowed';
  end if;
  if p_code is null or p_code !~ '^[0-9]{6}$' then
    raise exception 'bad_code';
  end if;
  select s.admin_whatsapp into v_to from public.notification_settings s where s.id;
  if v_to is null then
    raise exception 'no_number';
  end if;

  select * into v_row from private.admin_login_codes where user_id = v_uid;
  if found and v_row.window_start > now() - interval '1 hour' then
    if v_row.sent_count >= 6 then
      raise exception 'too_many_codes';
    end if;
    if v_row.last_sent_at > now() - interval '20 seconds' then
      raise exception 'wait_a_moment';
    end if;
  end if;

  insert into private.admin_login_codes as c (user_id, code_hash, expires_at)
  values (v_uid, encode(sha256(convert_to(p_code || ':' || v_uid::text, 'utf8')), 'hex'), now() + interval '10 minutes')
  on conflict (user_id) do update
    set code_hash = excluded.code_hash,
        expires_at = excluded.expires_at,
        attempts = 0,
        sent_count = case when c.window_start > now() - interval '1 hour' then c.sent_count + 1 else 1 end,
        window_start = case when c.window_start > now() - interval '1 hour' then c.window_start else now() end,
        last_sent_at = now();

  return jsonb_build_object('to', v_to);
end;
$$;
revoke execute on function public.admin_store_login_code(text, text) from public, anon;
grant execute on function public.admin_store_login_code(text, text) to authenticated;

-- Checks the code the person typed. Wrong tries are counted (5 per code). Returns a word instead of
-- raising, so the count is kept: ok | wrong | expired | locked | none.
create or replace function public.admin_verify_login_code(p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_sid text := ((select auth.jwt()) ->> 'session_id');
  v_row private.admin_login_codes;
begin
  if not private.is_admin_role() then
    raise exception 'not_admin';
  end if;
  if v_sid is null or v_sid !~* '^[0-9a-f-]{36}$' then
    raise exception 'no_session';
  end if;
  select * into v_row from private.admin_login_codes where user_id = v_uid for update;
  if not found then
    return 'none';
  end if;
  if v_row.expires_at <= now() then
    return 'expired';
  end if;
  if v_row.attempts >= 5 then
    return 'locked';
  end if;
  if p_code is not null
     and v_row.code_hash = encode(sha256(convert_to(btrim(p_code) || ':' || v_uid::text, 'utf8')), 'hex') then
    insert into private.admin_verified_sessions as s (session_id, user_id)
    values (v_sid::uuid, v_uid)
    on conflict (session_id) do update set verified_at = now(), user_id = excluded.user_id;
    update private.admin_login_codes set expires_at = now() where user_id = v_uid;
    delete from private.admin_verified_sessions where verified_at < now() - interval '30 days';
    return 'ok';
  end if;
  update private.admin_login_codes set attempts = attempts + 1 where user_id = v_uid;
  return 'wrong';
end;
$$;
revoke execute on function public.admin_verify_login_code(text) from public, anon;
grant execute on function public.admin_verify_login_code(text) to authenticated;

-- Turns the login code on or off. Only a fully signed-in admin can call it (is_admin(), not just the role).
-- Turning it on needs the admin WhatsApp number and the server secret to be set up first, and counts the
-- current session as verified so the person who switched it on is not locked out of this page.
create or replace function public.admin_set_login_check(p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_sid text := ((select auth.jwt()) ->> 'session_id');
begin
  if not (select private.is_admin()) then
    raise exception 'not_admin';
  end if;
  if p_on then
    if not exists (select 1 from public.notification_settings s where s.id and s.admin_whatsapp is not null) then
      raise exception 'need_number';
    end if;
    if not exists (select 1 from public.notification_settings s where s.id and s.secret_hash is not null) then
      raise exception 'need_secret';
    end if;
    if v_sid is null or v_sid !~* '^[0-9a-f-]{36}$' then
      raise exception 'no_session';
    end if;
    insert into private.admin_verified_sessions as s (session_id, user_id)
    values (v_sid::uuid, (select auth.uid()))
    on conflict (session_id) do update set verified_at = now();
  end if;
  update public.notification_settings set require_login_code = p_on where id;
end;
$$;
revoke execute on function public.admin_set_login_check(boolean) from public, anon;
grant execute on function public.admin_set_login_check(boolean) to authenticated;
