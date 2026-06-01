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

## Database objects (Supabase project `Tiandy`)

Added on top of the existing catalog:
- `tiandy_il_products` — new columns: `sku, price, currency, stock, min_order_qty, is_orderable`
- `tiandy_il_profiles` — dealer/admin accounts (auto-created on signup, `pending` by default)
- `tiandy_il_orders`, `tiandy_il_order_items`
- Functions: `tiandy_il_place_order`, `tiandy_il_is_admin`, `tiandy_il_is_approved_dealer`

## Local development

```bash
cp .env.example .env.local   # already filled for this project
npm install
npm run dev                  # http://localhost:3000
```

## Making yourself an admin

After signing up once, promote your account in the Supabase SQL editor:

```sql
update public.tiandy_il_profiles
set role = 'admin', status = 'approved'
where id = (select id from auth.users where email = 'YOUR_EMAIL');
```

Then the **ניהול** (admin) menu appears in the header.

## Routes

- `/` home · `/products` catalog · `/products/[slug]` product
- `/cart` · `/checkout`
- `/login` · `/register`
- `/account/orders` · `/account/orders/[id]`
- `/admin` · `/admin/orders` · `/admin/dealers` · `/admin/products`
