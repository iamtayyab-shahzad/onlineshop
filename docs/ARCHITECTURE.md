# Architecture & plan

## 1. What existed before Stage 1

The folder held a fresh `create-next-app` scaffold: Next.js 16.4.6 with Cache Components, React 19.3, Tailwind v4, the shadcn/ui base-nova style, and the Supabase JS libraries installed.

There was no app code, no database, no auth and no git repository of its own. The folder sat inside the home-folder git repo, so it now has its own repo.

## 2. Architecture

```
Phone browser / installed PWA
   │  Server Components render pages; only small pieces are client JS
   │  (add-to-cart buttons, cart page, bottom nav)
   ▼
Next.js on Vercel
   ├─ Public catalog  → cached ('use cache', tag "catalog"), anon Supabase client
   ├─ Customer data   → (Stage 2) per-request Supabase client with the user's session cookie
   └─ Admin pages     → (Stage 3) server-checked admin role; RLS enforces it again
   ▼
Supabase
   ├─ Postgres with Row Level Security on EVERY table
   ├─ Auth (customers + admins; role lives in profiles.role)
   └─ Storage: product-images (public), payment-proofs + voice-orders (private)
```

### Security model: how internal numbers stay hidden

- **Supplier prices live in separate tables:** `product_costs` and `order_item_costs`. RLS lets only admins read them.
  - Customer pages never select them, so there's no column on `products` that could leak by accident.
  - Verified: with the public key, `product_costs` returns 0 rows, and even an embedded join returns `null`.
- **Profit is never stored for customers to read.** It is computed in admin-only queries: selling total − supplier total.
- **Orders are created only by a server-side database function** (`place_order`, built in Stage 2). It:
  - reads the current selling and supplier prices itself;
  - snapshots both prices into `order_items` and `order_item_costs`;
  - computes totals and the delivery fee.

  The browser sends only product ids and quantities, so a tampered cart cannot change a price. Customers have no direct `insert` on `orders`.
- **Customers cannot change their own role.** `profiles.role` cannot be updated by customers: column-level grants allow only `full_name` and `phone`.
- **Admin checks:**
  - Policies use `private.is_admin()`, a SECURITY DEFINER function in a schema the API does not expose.
  - Admin pages will also check the role on the server before rendering.
- **Private uploads:**
  - Payment screenshots and voice notes go in private buckets.
  - Customers can upload only into `{their user id}/…` and read only their own files. Admins can read all.
- **No sensitive credentials are collected:**
  - The app never asks for JazzCash PINs, bank passwords, CVVs or OTPs, and the Help page warns customers about this.
  - "Proof of payment" is a transaction reference plus an optional screenshot. An admin verifies it by checking the actual account; a screenshot alone is not proof.
- **Security headers** are set in `next.config.ts`: nosniff, frame DENY, referrer policy, HSTS and permissions policy.

### Sign-in and order placement (Stage 2)

- **Phone + password sign-in, with no SMS cost.**
  - Supabase Auth needs an email, so the mobile number `03XXXXXXXXX` becomes an internal login id: `92XXXXXXXXXX@<domain>`.
  - `<domain>` is `AUTH_PHONE_EMAIL_DOMAIN`, or this project's Supabase host if that is unset. Supabase rejects `.local` and `.test`.
  - Customers never see this id, and no email is sent to it.
  - **Set the domain before launch and never change it afterwards.** Changing it breaks every existing login.
- **Required Supabase setting:** Authentication → Sign In / Providers → Email → **"Confirm email" must be OFF**. If it is on, sign-up creates the user but gives no session, and the customer sees "could not create your account".
- **Forgotten passwords:** customers call the shop. The admin sets a new password in Supabase → Authentication → Users. An in-app reset is a later stage.
- **Session refresh:** `src/proxy.ts` (Next 16's replacement for middleware) refreshes the Supabase session cookie on every page request.
  - Every page and server action still re-checks the user on the server (`getCurrentUser` / `requireUser`). Server actions are plain POSTs, so they never rely on the proxy.
- **Checkout:**
  - The browser sends only `{product id, qty}`, the chosen address id, the payment method, a note and a random request id.
  - `place_order` (SECURITY DEFINER, empty `search_path`) checks the address belongs to the caller, that items are active, quantities are 1–50, and the minimum order is met.
  - It then snapshots prices and records a `placed` status event.
  - The request id makes it idempotent: a double tap or a retry returns the same order.
  - The Supabase security advisor flags it as "SECURITY DEFINER callable by authenticated users". **This is intentional:** it is the only way customers can create orders. Execute is revoked from `anon` and `public`.
- **Addresses:** RLS limits each customer to their own rows. A unique partial index allows one main address per customer, and each customer is capped at 10 addresses in the server action.

## 3. Database schema (summary)

| Table | Purpose | Who can read |
|---|---|---|
| `profiles` | name, phone, role (`customer`/`admin`), auto-created on sign-up | self, admin |
| `store_settings` | single row: store name, delivery fee, minimum order, support phone/WhatsApp, delivery areas/hours, JazzCash/bank details for customers | everyone |
| `shops` | partner shop(s) + WhatsApp number for packing messages | admin |
| `categories` | name, Urdu name, slug, icon, order, active | everyone (active only) |
| `products` | name, Urdu name, unit, description, image, **selling_price**, active, featured | everyone (active only) |
| `product_costs` | **supplier_price** per product | admin |
| `addresses` | saved delivery addresses | owner, admin |
| `orders` | number (from 1001), status, payment method/status, delivery snapshot, subtotal, fee, total, source (app/voice/admin) | owner, admin |
| `order_items` | snapshot of name, unit, selling price, qty, line total | owner, admin |
| `order_item_costs` | snapshot of supplier unit price + line total | admin |
| `order_status_events` | status history (who/when/note) | owner, admin |
| `payment_proofs` | method, amount, transaction ref, screenshot path, verification | owner, admin |
| `monthly_list_items` | the customer's reusable list (product + qty) | owner |
| `voice_orders` | audio path, duration, address, note, status, linked order | owner, admin |

The enums are:
- order status: `placed → confirmed → sent_to_shop → packed → out_for_delivery → delivered`, or `cancelled`
- payment method: `cod | jazzcash | bank_transfer`
- payment status: `unpaid | pending_verification | paid | refunded`

## 4. Customer journey

1. Open the app (or the installed icon). The home screen shows search, the categories and popular items.
2. Add items with big buttons. The cart is saved on the phone, and no sign-in is needed to shop.
3. **Cart:** clear totals, the delivery fee and a minimum-order notice. Prices refresh from the server.
4. **Checkout (Stage 2):**
   - Sign in with phone + password, first time only.
   - Pick a saved address or add one.
   - Choose COD, JazzCash or Bank transfer.
   - Place the order.
5. **Success screen:** the order number, total, what happens next and how to pay (if not COD).
6. **My Orders:** status in plain words, order details, and a Reorder button.
7. **Account** has exactly: Profile · My Orders · My Addresses · My Monthly List · Help / Contact.
8. **Optional voice order:** hold to record and send. The admin types up the items.

WhatsApp is never required from customers, and the app sends them no automatic WhatsApp messages.

## 5. Admin journey (Stages 3–7)

1. **New orders list:** newest first, with a badge for unconfirmed orders.
2. **Order page:**
   - customer, address, items, selling total, supplier total, gross profit;
   - a status buttons timeline.
3. **"Copy WhatsApp message for shop":** a packing list with no customer prices, plus an "Open WhatsApp" link to the default shop number. The admin sends it manually.
4. **Update status:** sent to shop → packed → out for delivery → delivered.
5. **Payments:** a review queue for JazzCash/bank proofs. The admin checks the real account, then marks it verified or rejected. COD is marked paid on delivery.
6. **Products:** add or edit, set the selling and supplier prices independently, activate/deactivate, assign a category, upload an image.
7. **Customers and their addresses.**
8. **Voice orders:** play the recording, build the item list, and create the order on the customer's behalf.
9. **Reports:** sales, gross profit, top items, orders by status, and payments pending, by day, week or month.

### What was built for Stages 3, 4 and 6

- **Admin routes:** `/admin/login`, and under `src/app/admin/(panel)`: dashboard, orders (+ detail), payments, deliveries, voice, customers, reports, products (+ new/edit), images, categories, units, settings.
- **Authorization:** `adminDb()` in `src/lib/auth.ts` runs `requireAdmin()` and then returns the cookie-session Supabase client. Every admin page and server action calls it, because layouts and pages render in parallel, so the layout guard alone is not enough. RLS (`private.is_admin()`) is the second check. There is no service-role key in the app.
- **Uploads go straight from the browser to Storage** (server actions have a 1 MB body limit):
  - product photos: `product-images/library/<sha256>.webp`. The hash dedupes them, and the server only accepts paths in that form;
  - QR codes: `product-images/store/`;
  - payment screenshots: `payment-proofs/<uid>/`, private;
  - voice recordings: `voice-orders/<uid>/`, private. The admin plays them through short-lived signed URLs.
- **Payments:** the customer sends a TID and an optional screenshot, and never a PIN, OTP or password. When the admin verifies or rejects it, the order is set to paid or unpaid and the reviewer is recorded.
- **Voice orders:** the customer records up to 3 minutes and can pick an address and add a note. The admin listens, calls the customer, and can link the voice order to an order number.
- **Old orders are safe:** order items keep snapshots of the name, unit and price, so editing or deleting a product does not change past orders.

### Stage 5: My Monthly List

- Stored in `monthly_list_items` (one row per customer and product; RLS limits rows to the owner). Quantity is `numeric` and an optional `amount` holds "Rs X worth" lines.
- Server actions (`src/app/(shop)/account/monthly/actions.ts`) check every quantity against the product's current rules, using the same helpers as the cart, and never accept a price.
- "Add all to cart" runs in the browser against freshly fetched public prices, so the cart and checkout still recalculate everything on the server.
- Save buttons: product page and cart page. Unavailable products stay listed as "Not available right now" so the customer can remove them.

## 6. Staged roadmap

Each stage is small, complete and testable.

| Stage | Scope | Key pieces |
|---|---|---|
| **1 ✅** | Foundation | Schema + RLS + storage, sample catalog, catalog/search/product pages, device cart with server price refresh, help, account shell, PWA (manifest, icons, offline page), security headers |
| **2** | Sign-in & ordering | Phone+password auth (`@supabase/ssr`, proxy for session refresh), profile, addresses CRUD, checkout, `place_order` RPC with price snapshots, success screen, My Orders + details |
| **3** | Admin core | Admin layout/guard, products & prices, categories, orders list/detail, status changes with history, WhatsApp packing message, per-order profit, `revalidateTag("catalog")` on edits |
| **4** | Payments | Show JazzCash/bank details after ordering, proof submission (ref + optional screenshot), admin verification queue |
| **5** | Monthly list | Add from product/cart, edit quantities, "Add all to cart" |
| **6** | Voice orders | Record (MediaRecorder) → private upload → admin player → convert to order |
| **7** | Reports & launch | Reports page, Vercel deploy, real domain, final security/advisor review |

## 7. Assumptions made

1. **Currency is PKR**, shown as "Rs 1,450", with whole rupees.
2. The **interface is in English, with Urdu product and category names** shown underneath. A full Urdu interface can be added later.
3. **One delivery fee (Rs 150) and a minimum order (Rs 1,000)**, editable in `store_settings`. There are no per-area fees yet.
4. **One partner shop**, with room for more in the `shops` table.
5. **Sample catalog:** the 39 products and their prices are illustrative and must be replaced. The phone `0300-0000000` and "Partner Shop" are placeholders.
6. **Customer sign-in will use phone number + password.**
   - SMS OTP needs a paid SMS provider such as Twilio, and could be added later.
   - The phone number is mapped to an internal login id, so customers never see or need an email address.
7. **Prices are re-checked on the server.** The cart stores prices only for display; the server recalculates them at checkout.
8. **Light theme only, with large text** (17px base) and 48px+ buttons.
9. **The service worker does not cache pages or prices**, to avoid stale prices. It only shows an offline page.

## 8. Decisions / information needed from the owner

1. **Store name & branding.** The app currently says "Grocery Shop".
2. **Real data:**
   - products, units and both prices;
   - delivery fee and minimum order;
   - delivery areas and hours;
   - support phone/WhatsApp;
   - the partner shop's WhatsApp number.
3. **JazzCash and bank account details** to show customers. You can now enter these yourself in Admin → Settings → Payment accounts.
4. **Supabase dashboard setting for Stage 2:** turn **off** Authentication → Sign In / Providers → Email → *Confirm email*. Phone+password sign-in uses an internal email-style id, and Supabase's built-in mailer cannot deliver to it.
5. **First admin account:** after you sign up, run the SQL update shown in the README (Admin panel section).
6. **SMS OTP:** confirm whether phone + password is acceptable for now.
