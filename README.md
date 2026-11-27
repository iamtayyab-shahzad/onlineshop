# Grocery Shop

A simple, mobile-first grocery ordering app for non-tech-savvy customers.
Customers browse, add to cart and order. The admin forwards each order to the
partner shop on WhatsApp, collects it and delivers it.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind v4 · shadcn/ui (Base UI) · Supabase (Postgres, Auth, Storage, RLS) · Vercel · PWA

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design, database schema, security model and roadmap.

## Status

| Stage | What | State |
|---|---|---|
| 1 | Foundation: database + security, catalog, search, cart, help, installable PWA | ✅ Done |
| 2 | Phone sign-in, profile, addresses, checkout, order success, My Orders | 🟡 Built; end-to-end test waits for one Supabase setting (below) |
| 3 | Admin: products & two prices, units, categories, photos, orders, status, WhatsApp packing message, profit | 🟡 Built; needs your admin account (below) |
| 4 | Payments: JazzCash / Easypaisa / bank details + QR set by admin, customer proof (TID + screenshot), manual verification | 🟡 Built |
| 5 | My Monthly List (save from a product or the cart, change quantities, add all to cart) + one-tap reorder | 🟡 Built |
| 6 | Voice orders: customer records a message, admin listens and calls back | 🟡 Built |
| 7 | Reports (built) + production deploy on Vercel | See "Deploy" below |

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the two Supabase values
npm run dev                  # http://localhost:3000
```

Other commands: `npm run build` (production build), `npm run lint`.
`node scripts/make-icons.mjs` regenerates the app icons.

## Database

The Supabase project is **grocery-shop** (`iyxwcufvecdaguhuzrah`, region ap-south-1).
All schema changes are kept as SQL files in [`supabase/migrations`](supabase/migrations), applied in filename order:

1. `…_initial_schema.sql` – tables, enums, Row Level Security, storage buckets
2. `…_seed_sample_catalog.sql` – **sample** categories, products and prices (replace before launch)
3. `…_hide_internal_functions.sql` – moves helper functions out of the public API
4. `20261118190000_checkout_and_addresses.sql` – address limits, one main address, the `place_order` and `set_default_address` functions, idempotent order requests
5. `20261119100000_admin_units_images_payments.sql` – admin-managed units (decimal or whole), buy-by-amount, product photo library, payment accounts, payment proofs, voice orders, admin RPCs and reports
6. `20261120090000_monthly_list_decimals.sql` – Monthly List quantities can be decimals, and "Rs X worth" lines
7. `20261120100000_table_grants.sql` – explicit table access for new Supabase projects (Row Level Security still decides which rows)
8. `20261121090000_whatsapp_notifications.sql` – automatic WhatsApp order alerts: notification queue + status, admin-only settings, and the secret-protected functions that build each message
9. `20261122090000_admin_order_tools.sql` – three order stages (New / Delivered / Cancelled), order discount, admin edit-order and create-order-from-voice functions, sales report net of discount, and the optional WhatsApp admin login code
10. `20261123090000_product_variants.sql` – product sizes: `products.variant_of` links a size (e.g. 500 g) to its main product (one level only)
11. `20261124090000_voice_order_alerts.sql` – WhatsApp alert to the admin for every voice order (who, address, note), with resend if it failed

**Required Supabase setting (Stage 2):** in Authentication → Sign In / Providers → Email, turn **"Confirm email" OFF**.
Customers sign in with their mobile number and password, and there is no email to confirm.
Optional: set `AUTH_PHONE_EMAIL_DOMAIN` in `.env.local` / Vercel **before launch**, and never change it afterwards. See docs/ARCHITECTURE.md.

## Deploy (Vercel)

1. Push the repository to GitHub and import it in Vercel (framework: Next.js, default build settings).
2. Add two environment variables (Production and Preview): `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never add a service-role key.
3. Deploy, then in Supabase → Authentication → URL Configuration set **Site URL** to your Vercel address.
4. Do the admin setup below on the live site. Use https, because the microphone and "Add to Home Screen" need it.

## WhatsApp order alerts

When an order is saved, the server sends two WhatsApp messages through your WAHA server, after the customer already has their confirmation:

- **Admin:** customer name, phone, address, items, selling prices, total.
- **Shop:** product names, quantities, supplier prices and supplier total only.

A **voice order** sends the admin one message too (customer, address, note), followed by the recording itself as a WhatsApp voice note or audio file; it always stays in Admin → Voice orders too. An order never depends on WhatsApp. Each message has a row in `order_notifications` (pending / sending / sent / failed, tries, last error), so nothing is sent twice and failures can be resent from **Admin → order page** or **Settings → Retry failed messages**. Admin number and on/off: **Settings → Order alerts**. Shop number: **Settings → Supplier shop**.

## Admin order tools and login code

- **Three stages only:** New → Delivered, or Cancelled. Older in-between stages were folded into New by migration 9. **In progress** (admin menu) lists every New order with one-tap *Complete* / *Cancel*, and the total still to deliver.
- **Edit any order** (orders list or order page → Edit): change quantity or price, remove items, add shop products or one-off items, delivery fee and an extra discount. Totals and reports update.
- **Orders search:** by customer name, phone or order number, with live suggestions, plus a single date or a date range (Pakistan time).
- **Voice orders → Create order:** listen, pick the items, and the order is made with the customer's saved name and address, marked done, and the usual WhatsApp alerts go out.
- **Admin login code:** **Settings → Admin login code** turns on a 6-digit WhatsApp code after the password. It needs the admin WhatsApp number and the alert secret (`NOTIFY_SECRET`) to work, and the database enforces it for that login session. If WhatsApp is ever down and you are locked out, run this in the Supabase SQL Editor: `update public.notification_settings set require_login_code = false;`

## Product sizes (e.g. Vital Tea 1 kg / 500 g / 250 g)

One product can be sold in several sizes, each with its own price. Customers see only the main product in the shop; on its page they get a **Choose a size** box with every size and its price, and the one they tap is what goes in the cart.

- **Add sizes:** Admin → Products → open the main product → **Sizes → Add a size**. The form starts with the main product's name, category, unit and photo; type the size name (e.g. `500 g`), the selling price and the supplier price. Repeat for each size. Give the main product a size name too (e.g. `1 kg`) in its *Price label*.
- **Existing product → size:** open it and set **Size of** to the main product.
- Every size is a normal product behind the scenes (own price, supplier price, stock, photo, buying rules), so the cart, orders, Monthly List, reports and WhatsApp messages need no changes. A size can be hidden or marked out of stock on its own.
- One level only: a size cannot have sizes. Deleting a main product leaves its sizes in the shop as separate products.

Setup (once):

1. Run migration 8 (it is also at the end of `supabase/full_setup.sql`).
2. Add to `.env.local` and to Vercel (Production + Preview): `WAHA_BASE_URL`, `WAHA_API_KEY`, `WAHA_SESSION`, `NOTIFY_SECRET`, and optionally `ORDER_ADMIN_WHATSAPP` / `ORDER_SHOP_WHATSAPP` (fallbacks when Settings is empty). See `.env.example`.
3. Store the secret's hash in the database. Hash your `NOTIFY_SECRET` with `node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "<your secret>"`, then run in the SQL Editor: `update public.notification_settings set secret_hash = '<that hash>';`

Why a secret: supplier prices are admin-only in the database. The message text is built by database functions that only answer a server that knows `NOTIFY_SECRET`, so a customer's own login cannot read them. There is no service-role key in the app.

## Admin panel (Stages 3, 4, 6)

Open **/admin** (sign in at /admin/login). Every admin page and action checks the admin role on the server, and Row Level Security checks it again in the database.

**Make your account the admin (one time).** Sign up in the shop with your mobile number, then run this in Supabase → SQL Editor (use your number in `03XXXXXXXXX` form):

```sql
update public.profiles set role = 'admin' where phone = '03XXXXXXXXX';
```

Then, in the admin panel:

1. **Settings → Payment accounts:** enter the JazzCash / Easypaisa number, the bank account details, and upload the QR codes. Customers see these after ordering.
2. **Units:** add or rename units, and choose whether each allows decimals (kg) or only whole numbers (packet).
3. **Images:** drag in the photos from `pictures/optimized/`. Files with the same name as a product are suggested as matches; tick the ones that are right and confirm. Duplicates are skipped automatically.
4. **Products:** set the selling and supplier prices, unit, buy by quantity and/or amount, min/max, stock and the featured flag. Deleting a product never changes old orders.

Payments are verified **by hand**: check your real JazzCash/bank account for the TID before you press *Verify*. A screenshot alone is not proof. Voice orders appear under **Voice orders**; listen, call the customer, and mark them done.

**Photos:** `node scripts/optimize-pictures.mjs` turns `pictures/` into web-ready WebP files in `pictures/optimized/`. It only resizes and compresses your real photos; it does not create new angles.

**Supabase security setting:** turn on Authentication → Passwords → *Leaked password protection*.

Regenerate TypeScript types after a schema change and save them to `src/lib/database.types.ts`.

## Test Stage 1 by hand

On a phone, or with your browser's phone view (F12, then the device toolbar):

1. **Home**: you see the search box, 11 categories and "Popular items".
2. **Browse**: tap **Atta & Flour**, then **Add to cart** on an item. The button becomes a − / + stepper and the Cart tab shows a badge.
3. **Product page**: tap a product name. You see the Urdu name, unit, price and a large Add button.
4. **Search**: try `daal` (4 items), `چاول` (Urdu), `rice basmati` (word order doesn't matter), and `xyz` (a friendly "Nothing found" message).
5. **Cart**:
   - Change quantities and check that Items + Delivery (Rs 150) = Total.
   - With less than Rs 1,000 of items, a minimum-order notice shows and the button says "Add more items".
   - Close and reopen the browser; the cart is still there.
6. **Checkout**: see "Test Stage 2" below.
7. **Account**: shows exactly the five sections. **Help**: shows call/WhatsApp buttons, delivery info, how-to-order steps and a payment safety warning.
8. **Install**: on the live https site, in Chrome on Android, the home page shows an **Install our app** card. One tap opens Chrome's install box. On iPhone the card shows the Share → *Add to Home Screen* steps instead.
   - The card also appears after an order is placed and on the Help page.
   - The home-page card can be closed for 14 days.
   - It disappears once the app is installed, and never shows inside the installed app.
   - On Android browsers that don't offer one-tap install (for example, a link opened inside WhatsApp), only the Help page shows it, with the ⋮ menu steps.

## Test Stage 2 by hand

First turn "Confirm email" OFF in Supabase (see Database above). Then run `npm run build && npm start`.

1. **Sign up**: Account → Create an account. Enter a name, a mobile number (`0300 1234567`, `+92 300…` and `92300…` all work) and a password. You land on My account, signed in.
2. **Sign in again**: sign out, then sign in with the same number and password. A wrong password shows a friendly message.
3. **Profile**: change your name and save. The mobile number can't be changed by the customer.
4. **Addresses**: add Home and Office, make Office the main address, edit one, then delete one. If you delete the main address, another one becomes main.
5. **Checkout**: fill the cart above Rs 1,000, then Continue to checkout. Choose an address (or "Add delivery address", which brings you back here with it selected), a payment method and a note, then **Place order**.
6. **Success screen**: shows the order number and total. JazzCash and bank transfer also show the payment details (from Store settings) and the "never share your PIN" warning. The cart is now empty.
7. **My Orders**: the new order is listed as "Order received". Open it to see the progress steps, items with saved prices, the address and the payment status.
8. **Reorder**: "Order these items again" puts the items back in the cart at today's prices.
9. **Security checks**:
   - Signed out, opening `/checkout`, `/account/orders` or `/account/addresses` sends you to sign in.
   - Opening another customer's order link shows "not found".
   - Page source never contains supplier prices.
