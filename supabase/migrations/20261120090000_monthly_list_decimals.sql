-- Monthly list: allow decimal quantities (1.5 kg) and "Rs X worth" lines, like the cart.
-- The table was empty when this ran; widening int -> numeric loses nothing.
alter table public.monthly_list_items
  alter column quantity type numeric(10,3) using quantity::numeric,
  add column if not exists amount integer check (amount is null or amount > 0);
