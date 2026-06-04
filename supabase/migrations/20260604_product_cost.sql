-- Real per-unit cost on products (feature: accurate profit/margins).
--
-- Until now profit was estimated from average purchase unit_cost. This adds an
-- explicit `cost` column the admin can set per product; the dashboard prefers it
-- and falls back to the purchase-average when cost is 0/unset.

alter table store.products
  add column if not exists cost numeric not null default 0;

-- Re-expose the products view with the new column (security_invoker preserved).
create or replace view public.products
  with (security_invoker = on)
as
  select
    id, category_id, slug, name_he, short_desc_he, description_he, image_url,
    datasheet_url, specs, is_featured, sort, sku, price, currency, stock,
    min_order_qty, is_orderable, created_at, updated_at, deleted_at,
    reorder_point, price_contractor, cost
  from store.products;
