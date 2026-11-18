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
| 2 | Phone sign-in, profile, addresses, checkout, order success, My Orders | Next |
| 3 | Admin: products & two prices, orders, status, WhatsApp packing message, profit | |
| 4 | Payments: JazzCash / bank transfer proof upload + manual verification | |
| 5 | My Monthly List + one-tap reorder | |
| 6 | Voice orders (record → admin converts to items) | |
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
6. **Checkout**: shows "coming in the next update" (built in Stage 2).
7. **Account**: shows exactly the five sections. **Help**: shows call/WhatsApp buttons, delivery info, how-to-order steps and a payment safety warning.
8. **Install**: in Chrome on Android, after `npm run build && npm start`, use the menu and pick "Install app".
