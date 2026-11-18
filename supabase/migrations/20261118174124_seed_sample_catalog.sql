-- SAMPLE DATA: replace prices, phone numbers and shop details with real values before launch.
insert into public.store_settings (id, store_name, delivery_fee, min_order_amount, support_phone, support_whatsapp, delivery_areas, delivery_hours)
values (true, 'Grocery Shop', 150, 1000, '0300-0000000', '0300-0000000', 'Local area (to be confirmed)', '10:00 AM – 9:00 PM, every day');

insert into public.shops (name, whatsapp_phone, address, is_default)
values ('Partner Shop', '0300-0000000', 'To be confirmed', true);

insert into public.categories (name, name_urdu, slug, icon, sort_order) values
  ('Atta & Flour', 'آٹا', 'atta-flour', '🌾', 1),
  ('Rice', 'چاول', 'rice', '🍚', 2),
  ('Daal & Beans', 'دالیں', 'daal-beans', '🫘', 3),
  ('Oil & Ghee', 'تیل اور گھی', 'oil-ghee', '🫒', 4),
  ('Sugar, Salt & Basics', 'چینی اور نمک', 'sugar-salt-basics', '🧂', 5),
  ('Tea & Drinks', 'چائے', 'tea-drinks', '☕', 6),
  ('Spices & Masala', 'مصالحے', 'spices-masala', '🌶️', 7),
  ('Milk & Dairy', 'دودھ', 'milk-dairy', '🥛', 8),
  ('Snacks & Biscuits', 'بسکٹ', 'snacks-biscuits', '🍪', 9),
  ('Cleaning & Household', 'صفائی', 'cleaning-household', '🧼', 10),
  ('Personal Care', 'ذاتی نگہداشت', 'personal-care', '🧴', 11);

with p (cat, name, name_urdu, slug, unit, sell, cost, featured, sort) as (values
  ('atta-flour', 'Chakki Atta', 'چکی آٹا', 'chakki-atta-10kg', '10 kg bag', 1450, 1360, true, 1),
  ('atta-flour', 'Chakki Atta', 'چکی آٹا', 'chakki-atta-5kg', '5 kg bag', 750, 700, false, 2),
  ('atta-flour', 'Maida', 'میدہ', 'maida-1kg', '1 kg', 170, 150, false, 3),
  ('atta-flour', 'Besan', 'بیسن', 'besan-1kg', '1 kg', 320, 290, false, 4),
  ('rice', 'Basmati Rice', 'باسمتی چاول', 'basmati-rice-5kg', '5 kg', 1900, 1750, true, 1),
  ('rice', 'Basmati Rice', 'باسمتی چاول', 'basmati-rice-1kg', '1 kg', 400, 365, false, 2),
  ('rice', 'Sella Rice', 'سیلا چاول', 'sella-rice-5kg', '5 kg', 1750, 1600, false, 3),
  ('daal-beans', 'Daal Chana', 'دال چنا', 'daal-chana-1kg', '1 kg', 300, 270, true, 1),
  ('daal-beans', 'Daal Moong', 'دال مونگ', 'daal-moong-1kg', '1 kg', 360, 325, false, 2),
  ('daal-beans', 'Daal Masoor', 'دال مسور', 'daal-masoor-1kg', '1 kg', 330, 300, false, 3),
  ('daal-beans', 'Daal Mash', 'دال ماش', 'daal-mash-1kg', '1 kg', 520, 475, false, 4),
  ('daal-beans', 'Kala Chana', 'کالا چنا', 'kala-chana-1kg', '1 kg', 290, 260, false, 5),
  ('oil-ghee', 'Cooking Oil', 'کوکنگ آئل', 'cooking-oil-5l', '5 litre bottle', 2650, 2480, true, 1),
  ('oil-ghee', 'Cooking Oil', 'کوکنگ آئل', 'cooking-oil-1l', '1 litre pouch', 560, 520, false, 2),
  ('oil-ghee', 'Banaspati Ghee', 'بناسپتی گھی', 'banaspati-ghee-5kg', '5 kg tin', 2500, 2340, false, 3),
  ('oil-ghee', 'Banaspati Ghee', 'بناسپتی گھی', 'banaspati-ghee-1kg', '1 kg pouch', 530, 495, false, 4),
  ('sugar-salt-basics', 'Sugar', 'چینی', 'sugar-1kg', '1 kg', 165, 152, true, 1),
  ('sugar-salt-basics', 'Sugar', 'چینی', 'sugar-5kg', '5 kg', 810, 755, false, 2),
  ('sugar-salt-basics', 'Iodized Salt', 'نمک', 'salt-800g', '800 g', 60, 50, false, 3),
  ('sugar-salt-basics', 'Eggs', 'انڈے', 'eggs-dozen', '1 dozen', 330, 300, true, 4),
  ('tea-drinks', 'Black Tea (Loose)', 'پتی', 'black-tea-450g', '450 g pack', 850, 790, true, 1),
  ('tea-drinks', 'Black Tea (Loose)', 'پتی', 'black-tea-190g', '190 g pack', 380, 350, false, 2),
  ('tea-drinks', 'Green Tea Bags', 'سبز چائے', 'green-tea-30', '30 bags', 300, 270, false, 3),
  ('spices-masala', 'Red Chilli Powder', 'لال مرچ', 'red-chilli-200g', '200 g', 260, 235, false, 1),
  ('spices-masala', 'Haldi Powder', 'ہلدی', 'haldi-200g', '200 g', 180, 160, false, 2),
  ('spices-masala', 'Dhania Powder', 'دھنیا', 'dhania-200g', '200 g', 170, 150, false, 3),
  ('spices-masala', 'Garam Masala', 'گرم مصالحہ', 'garam-masala-100g', '100 g', 210, 190, false, 4),
  ('spices-masala', 'Biryani Masala', 'بریانی مصالحہ', 'biryani-masala-pack', '1 pack', 130, 115, false, 5),
  ('milk-dairy', 'Packed Milk', 'دودھ', 'packed-milk-1l', '1 litre', 290, 270, true, 1),
  ('milk-dairy', 'Yogurt', 'دہی', 'yogurt-1kg', '1 kg tub', 330, 300, false, 2),
  ('milk-dairy', 'Butter', 'مکھن', 'butter-200g', '200 g', 650, 600, false, 3),
  ('snacks-biscuits', 'Tea Biscuits', 'بسکٹ', 'tea-biscuits-family', 'Family pack', 220, 195, false, 1),
  ('snacks-biscuits', 'Rusk', 'رس', 'rusk-pack', '1 pack', 250, 225, false, 2),
  ('cleaning-household', 'Washing Powder', 'سرف', 'washing-powder-1kg', '1 kg', 520, 480, false, 1),
  ('cleaning-household', 'Dishwash Bar', 'برتن صابن', 'dishwash-bar', '1 bar', 110, 95, false, 2),
  ('cleaning-household', 'Floor Cleaner', 'فرش صاف کرنے والا', 'floor-cleaner-1l', '1 litre', 450, 410, false, 3),
  ('personal-care', 'Bath Soap', 'نہانے کا صابن', 'bath-soap', '1 bar', 150, 135, false, 1),
  ('personal-care', 'Toothpaste', 'ٹوتھ پیسٹ', 'toothpaste-100g', '100 g', 280, 255, false, 2),
  ('personal-care', 'Shampoo', 'شیمپو', 'shampoo-200ml', '200 ml', 520, 480, false, 3)
), ins as (
  insert into public.products (category_id, name, name_urdu, slug, unit_label, selling_price, is_featured, sort_order)
  select c.id, p.name, p.name_urdu, p.slug, p.unit, p.sell, p.featured, p.sort
  from p join public.categories c on c.slug = p.cat
  returning id, slug
)
insert into public.product_costs (product_id, supplier_price)
select ins.id, p.cost from ins join p on p.slug = ins.slug;
