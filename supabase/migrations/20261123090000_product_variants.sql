-- Product sizes ("variants"): one shop product with several sizes, e.g. Vital Tea 1 kg / 500 g / 250 g.
--
-- Every size is a normal product row (its own price, supplier price, stock, photo, buying rules), so the cart,
-- orders, the Monthly List and reports need no change. `variant_of` points a size at its main product.
-- The shop lists only main products; the main product's page shows its sizes with their prices.

alter table public.products
  add column variant_of uuid references public.products (id) on delete set null;

alter table public.products
  add constraint products_variant_not_self check (variant_of is null or variant_of <> id);

create index products_variant_of_idx on public.products (variant_of) where variant_of is not null;

-- One level only: a size cannot have sizes of its own, and a product that has sizes cannot become a size.
create or replace function private.check_product_variant()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.variant_of is not null then
    if exists (select 1 from public.products p where p.id = new.variant_of and p.variant_of is not null) then
      raise exception 'variant_of_variant';
    end if;
    if exists (select 1 from public.products p where p.variant_of = new.id) then
      raise exception 'has_variants';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.check_product_variant() from public, anon, authenticated;

create trigger products_check_variant
  before insert or update of variant_of on public.products
  for each row execute function private.check_product_variant();
