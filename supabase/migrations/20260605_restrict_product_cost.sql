-- Product cost (purchase price / margin) must be visible to super admins only.
-- Previously public.products exposed `cost` to everyone — RLS allows public
-- SELECT on non-deleted rows — so any dealer (or even an anonymous visitor)
-- could read the purchase cost through the API. Mask it per-caller so only a
-- super admin sees the real value; everyone else gets NULL.
create or replace view public.products
with (security_invoker = on) as
select
  id,
  category_id,
  slug,
  name_he,
  short_desc_he,
  description_he,
  image_url,
  datasheet_url,
  specs,
  is_featured,
  sort,
  sku,
  price,
  currency,
  stock,
  min_order_qty,
  is_orderable,
  created_at,
  updated_at,
  deleted_at,
  reorder_point,
  price_contractor,
  case when store.is_super_admin() then cost else null end as cost,
  barcode
from store.products;

-- The masked `cost` column is no longer auto-updatable through the view, so
-- writes must omit it. Super admins set cost through this guarded RPC instead.
create or replace function public.admin_set_product_cost(p_id uuid, p_cost numeric)
returns void
language plpgsql
security definer
set search_path = store, public
as $$
begin
  if not store.is_super_admin() then
    raise exception 'forbidden: super admin only';
  end if;
  update store.products set cost = coalesce(p_cost, 0) where id = p_id;
end;
$$;

grant execute on function public.admin_set_product_cost(uuid, numeric) to authenticated;
