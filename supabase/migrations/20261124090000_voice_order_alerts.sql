-- WhatsApp alert to the admin when a customer sends a voice order.
--
-- Same safety model as the order alerts: the message text is built here, and only a server that
-- knows NOTIFY_SECRET gets it. Nothing here can stop a voice order from being saved.

alter table public.voice_orders
  add column alert_claimed_at timestamptz,
  add column alerted_at timestamptz,
  add column alert_error text;

-- Takes the alert for ONE voice order. Returns null when there is nothing to send
-- (alerts are off, already sent, or another request is sending it right now).
create or replace function public.claim_voice_alert(
  p_voice_id uuid, p_secret text, p_force boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_v public.voice_orders;
  v_to text;
  v_name text;
  v_phone text;
  v_addr public.addresses;
begin
  if not private.notify_secret_ok(p_secret) then
    raise exception 'not_allowed';
  end if;
  if not coalesce((select alerts_enabled from public.notification_settings where id), false) then
    return null;
  end if;

  update public.voice_orders v
     set alert_claimed_at = now()
   where v.id = p_voice_id
     and (v.alert_claimed_at is null or v.alert_claimed_at < now() - interval '2 minutes')
     and (p_force or v.alerted_at is null)
  returning * into v_v;
  if not found then
    return null;
  end if;

  select admin_whatsapp into v_to from public.notification_settings where id;
  select p.full_name, p.phone into v_name, v_phone from public.profiles p where p.id = v_v.user_id;
  select * into v_addr from public.addresses a where a.id = v_v.address_id;

  return jsonb_build_object(
    'to', v_to,
    'payload', jsonb_build_object(
      'placed_at', v_v.created_at,
      'customer_name', coalesce(nullif(v_addr.recipient_name, ''), v_name),
      'customer_phone', coalesce(nullif(v_addr.phone, ''), v_phone),
      'area', v_addr.area,
      'address', v_addr.address_line,
      'landmark', v_addr.landmark,
      'note', v_v.customer_note,
      'seconds', v_v.duration_seconds,
      'audio_path', v_v.audio_path
    )
  );
end;
$$;
revoke execute on function public.claim_voice_alert(uuid, text, boolean) from public, anon;
grant execute on function public.claim_voice_alert(uuid, text, boolean) to authenticated;

create or replace function public.record_voice_alert(
  p_voice_id uuid, p_secret text, p_ok boolean, p_error text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.notify_secret_ok(p_secret) then
    raise exception 'not_allowed';
  end if;
  update public.voice_orders
     set alerted_at = case when p_ok then now() else alerted_at end,
         alert_error = case when p_ok then null else left(coalesce(p_error, 'Unknown error'), 300) end,
         alert_claimed_at = null
   where id = p_voice_id;
end;
$$;
revoke execute on function public.record_voice_alert(uuid, text, boolean, text) from public, anon;
grant execute on function public.record_voice_alert(uuid, text, boolean, text) to authenticated;
