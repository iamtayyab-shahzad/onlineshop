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
