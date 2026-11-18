create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- Policies reference functions by OID, so moving schemas keeps them working
alter function public.is_admin() set schema private;
alter function public.handle_new_user() set schema private;
alter function public.set_updated_at() set schema private;

revoke execute on function private.handle_new_user() from public, anon, authenticated;
revoke execute on function private.set_updated_at() from public, anon, authenticated;
