-- Product barcode (feature: camera scanning).
--
-- The Barcode/QR scanner matches a scanned code against SKU/slug already, but
-- the EAN/UPC printed on a manufacturer's box rarely equals our SKU. This adds
-- an optional `barcode` column so a scan of the physical box resolves straight
-- to the product. Matching stays forgiving (barcode → SKU → slug), so existing
-- rows without a barcode keep working.

alter table store.products
  add column if not exists barcode text;

-- Help exact lookups by scanned code (nullable, so partial unique index).
create index if not exists products_barcode_idx
  on store.products (barcode)
  where barcode is not null;

-- Re-expose the products view with the new column (security_invoker preserved).
create or replace view public.products
  with (security_invoker = on)
as
  select
    id, category_id, slug, name_he, short_desc_he, description_he, image_url,
    datasheet_url, specs, is_featured, sort, sku, price, currency, stock,
    min_order_qty, is_orderable, created_at, updated_at, deleted_at,
    reorder_point, price_contractor, cost, barcode
  from store.products;
