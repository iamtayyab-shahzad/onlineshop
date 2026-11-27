-- One-time data fix (no schema change; safe to run more than once).
--
-- Before this fix, a size that started with its main product's photo kept showing that photo even
-- after its own photo was uploaded. This makes every such size show its own first photo.
-- Sizes without photos of their own keep showing the main product's photo.

update public.products s
   set image_url = regexp_replace(m.image_url, '/product-images/.*$', '/product-images/')
                   || (select pi.path
                         from public.product_images pi
                        where pi.product_id = s.id
                        order by pi.sort_order, pi.created_at
                        limit 1)
  from public.products m
 where s.variant_of = m.id
   and s.image_url = m.image_url
   and m.image_url like '%/storage/v1/object/public/product-images/%'
   and exists (select 1 from public.product_images pi where pi.product_id = s.id);
