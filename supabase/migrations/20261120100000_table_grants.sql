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
