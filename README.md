# Tiandy סוחרים — פורטל הזמנות סיטונאי (B2B Dealer Portal)

A B2B wholesale ordering portal for the official Tiandy importer. Approved
dealers / shop owners log in, browse the catalog at **dealer prices**, place
orders, and pay (card / bank transfer / cash on delivery). The importer manages
products, pricing, stock, dealers, and orders from an admin panel.

> The storefront UI is in Hebrew (RTL) to match the existing product catalog
> (`tiandy_il_*` tables, Israeli market).

## Stack

- **Next.js 15** (App Router, TypeScript) + **Tailwind CSS**
- **Supabase** — Postgres, Auth, Row Level Security
- **Static export** (`output: "export"`) — the whole app renders in the
  browser and talks to Supabase directly, so it can be hosted as plain static
  files on **GitHub Pages**.

## How it works

| Role | Capabilities |
|------|--------------|
| Visitor | Browse catalog (prices hidden) |
| Dealer (pending) | Register; waits for importer approval |
| Dealer (approved) | See prices, add to cart, checkout, track orders |
| Admin | Approve dealers, manage prices/stock, manage order status |

### Key security design
- Prices/ordering are gated to **approved** dealers.
- Orders are created via the `tiandy_il_place_order` Postgres function
  (`SECURITY DEFINER`), which **recomputes prices from the database**, validates
  stock and minimum order quantity, decrements stock, and writes the order +
  items atomically — the client never sets prices.
- RLS: dealers see only their own orders/profile; catalog writes are admin-only.

## Database — isolated `store` schema (Supabase project `Tiandy`)

The store lives entirely in its **own Postgres schema `store`**, completely
separate from the website's `public.tiandy_il_*` tables. The website's tables
and policies are untouched; the store keeps its **own copy** of the catalog.

`store` schema objects:
- `store.categories`, `store.products` (with `sku, price, currency, stock,
  min_order_qty, is_orderable`), `store.settings`, `store.banners` — seeded from
  the website catalog
- `store.profiles` — dealer/admin accounts (auto-created `pending` on signup)
- `store.orders`, `store.order_items`
- Functions: `store.place_order`, `store.is_admin`, `store.is_approved_dealer`

The `store` schema is exposed to the API (PostgREST `db_schemas` includes
`store`), and the app's Supabase clients default to it via `db: { schema: "store" }`.
If you ever recreate the project, add `store` under **Settings → API → Exposed
schemas** in the Supabase dashboard.

## Connection keys

The Supabase URL and **publishable (anon) key** live in
[`src/lib/config.ts`](src/lib/config.ts) — committed on purpose so the site
builds and runs with **no server secrets**. This is safe: those keys are meant
to ship in the browser, and all access is enforced by Postgres Row Level
Security. (Never put the `service_role` key here.) To point at a different
project, set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
`.env.local`, which override the file.

## Local development

```bash
npm install
npm run dev                  # http://localhost:3000
```

## Deploying to GitHub Pages

A workflow ([`.github/workflows/nextjs.yml`](.github/workflows/nextjs.yml))
builds the static export and publishes it on every push to `main`:

1. In the repo, go to **Settings → Pages** and set **Source = GitHub Actions**.
2. Push to `main` (or run the workflow manually from the **Actions** tab).
3. The site appears at `https://<user>.github.io/<repo>/`.

The workflow injects the correct sub-path (`basePath`) automatically, so it
works whether served from a project sub-path or a custom domain. No secrets are
required because the Supabase keys are in `src/lib/config.ts`.

> Because there is no server, pages fetch their data in the browser. Catalog
> changes made in the admin panel are reflected immediately — no rebuild needed.

## Making yourself an admin

After signing up once, promote your account in the Supabase SQL editor:

```sql
update store.profiles
set role = 'admin', status = 'approved'
where id = (select id from auth.users where email = 'YOUR_EMAIL');
```

Then the **ניהול** (admin) menu appears in the header.

## Routes

- `/` home · `/products` catalog · `/product?slug=…` product
- `/cart` · `/checkout`
- `/login` · `/register`
- `/account/orders` · `/account/order?id=…`
- `/admin` · `/admin/orders` · `/admin/dealers` · `/admin/products`

> Product and order detail use query strings (`?slug=`, `?id=`) instead of path
> segments so a single static page can serve any item — required for static
> hosting, where arbitrary runtime IDs can't be pre-rendered as files.
