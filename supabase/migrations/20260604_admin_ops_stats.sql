-- Operations-center dashboard aggregator for admins / super-admins.
--
-- A single SECURITY DEFINER function returns every metric the admin overview
-- screen needs as one jsonb payload (KPIs, profit estimate, status breakdown,
-- daily revenue/profit series, top products, recent orders, low stock).
--
-- Profit is *estimated*: there is no cost column on products, so per-product
-- cost is derived from the average purchase `unit_cost` (stock_movements with
-- reason='purchase', falling back to purchase_order_items). When a product has
-- never been purchased its cost is unknown (treated as 0); the client surfaces
-- this as an estimate.
--
-- Access is gated on store.is_admin() inside the function, and the public
-- wrapper is what the browser (supabase-js, public schema) actually calls.

create or replace function store.admin_ops_stats(days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = store, public
as $$
declare
  result jsonb;
  d integer := greatest(1, least(coalesce(days, 14), 90));
begin
  if not store.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with prod_cost as (
    select
      p.id,
      p.name_he,
      p.stock,
      p.price,
      p.reorder_point,
      p.deleted_at,
      coalesce(
        (select avg(sm.unit_cost) from store.stock_movements sm
          where sm.product_id = p.id and sm.reason = 'purchase' and sm.unit_cost is not null),
        (select avg(poi.unit_cost) from store.purchase_order_items poi
          where poi.product_id = p.id and poi.unit_cost is not null)
      ) as cost
    from store.products p
  ),
  item_profit as (
    select
      oi.order_id,
      oi.line_total,
      oi.qty * coalesce(pc.cost, 0) as cogs
    from store.order_items oi
    left join prod_cost pc on pc.id = oi.product_id
  )
  select jsonb_build_object(
    'generated_at', now(),
    'kpi', jsonb_build_object(
      'revenue_paid',       (select coalesce(sum(total), 0) from store.orders where payment_status = 'paid'),
      'revenue_month',      (select coalesce(sum(total), 0) from store.orders
                               where created_at >= date_trunc('month', now())),
      'revenue_prev_month', (select coalesce(sum(total), 0) from store.orders
                               where created_at >= date_trunc('month', now()) - interval '1 month'
                                 and created_at <  date_trunc('month', now())),
      'profit_paid',        (select coalesce(sum(ip.line_total - ip.cogs), 0)
                               from item_profit ip
                               join store.orders o on o.id = ip.order_id
                               where o.payment_status = 'paid'),
      'cogs_paid',          (select coalesce(sum(ip.cogs), 0)
                               from item_profit ip
                               join store.orders o on o.id = ip.order_id
                               where o.payment_status = 'paid'),
      'inventory_value',    (select coalesce(sum(stock * coalesce(cost, 0)), 0)
                               from prod_cost where deleted_at is null),
      'inventory_retail',   (select coalesce(sum(stock * price), 0)
                               from prod_cost where deleted_at is null)
    ),
    'counts', jsonb_build_object(
      'orders_total',    (select count(*) from store.orders),
      'orders_pending',  (select count(*) from store.orders where status = 'pending'),
      'orders_today',    (select count(*) from store.orders where created_at >= date_trunc('day', now())),
      'dealers_total',   (select count(*) from store.profiles where role = 'dealer'),
      'dealers_pending', (select count(*) from store.profiles where status = 'pending'),
      'products_total',  (select count(*) from store.products where deleted_at is null),
      'products_low',    (select count(*) from prod_cost
                            where deleted_at is null and reorder_point > 0 and stock <= reorder_point),
      'quotes_pending',  (select count(*) from store.quotes where status in ('draft', 'sent'))
    ),
    'orders_by_status', (
      select coalesce(jsonb_object_agg(status, c), '{}'::jsonb)
      from (select status, count(*) c from store.orders group by status) s
    ),
    'series', (
      select coalesce(jsonb_agg(row order by (row->>'day')), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'day', g::date,
          'revenue', coalesce((select sum(o.total)  from store.orders o where o.created_at::date = g::date), 0),
          'orders',  coalesce((select count(*)       from store.orders o where o.created_at::date = g::date), 0),
          'profit',  coalesce((select sum(ip.line_total - ip.cogs)
                                 from item_profit ip
                                 join store.orders o on o.id = ip.order_id
                                 where o.created_at::date = g::date), 0)
        ) as row
        from generate_series(
          date_trunc('day', now()) - ((d - 1) || ' days')::interval,
          date_trunc('day', now()),
          '1 day'
        ) g
      ) t
    ),
    'top_products', (
      select coalesce(jsonb_agg(row), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'name', max(oi.name_he),
          'qty', sum(oi.qty),
          'revenue', sum(oi.line_total)
        ) as row
        from store.order_items oi
        group by oi.product_id
        order by sum(oi.line_total) desc
        limit 6
      ) t
    ),
    'recent_orders', (
      select coalesce(jsonb_agg(row), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', o.id,
          'order_number', o.order_number,
          'total', o.total,
          'currency', o.currency,
          'status', o.status,
          'payment_status', o.payment_status,
          'created_at', o.created_at,
          'dealer', coalesce(pr.company, pr.full_name)
        ) as row
        from store.orders o
        left join store.profiles pr on pr.id = o.dealer_id
        order by o.created_at desc
        limit 8
      ) t
    ),
    'low_stock', (
      select coalesce(jsonb_agg(row), '[]'::jsonb)
      from (
        select jsonb_build_object('name', name_he, 'stock', stock, 'reorder', reorder_point) as row
        from prod_cost
        where deleted_at is null and reorder_point > 0 and stock <= reorder_point
        order by (stock::float / nullif(reorder_point, 0)) asc
        limit 8
      ) t
    )
  ) into result;

  return result;
end;
$$;

-- Public wrapper the browser client calls (PostgREST only exposes `public`).
create or replace function public.admin_ops_stats(days integer default 14)
returns jsonb
language sql
security definer
set search_path = store, public
as $$
  select store.admin_ops_stats(days);
$$;

grant execute on function store.admin_ops_stats(integer)  to authenticated;
grant execute on function public.admin_ops_stats(integer) to authenticated;
