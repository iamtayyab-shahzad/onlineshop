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
| 5 | My Monthly List + one-tap reorder | |
| 6 | Voice orders: customer records a message, admin listens and calls back | 🟡 Built |
| 7 | Reports + production deploy on Vercel | |

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

**Required Supabase setting (Stage 2):** in Authentication → Sign In / Providers → Email, turn **"Confirm email" OFF**.
Customers sign in with their mobile number and password, and there is no email to confirm.
Optional: set `AUTH_PHONE_EMAIL_DOMAIN` in `.env.local` / Vercel **before launch**, and never change it afterwards. See docs/ARCHITECTURE.md.

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
8. **Install**: in Chrome on Android, after `npm run build && npm start`, use the menu and pick "Install app".

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
