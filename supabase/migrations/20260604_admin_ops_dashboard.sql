-- Rich operations dashboard aggregator (v2): custom date range + previous-period
-- comparison + real product cost + per-product/category margins + stock-depletion
-- forecast + activity feed + monthly goal progress.
--
-- Profit uses the explicit products.cost when set, else the average purchase
-- unit_cost (stock_movements, then purchase_order_items). Admin-gated.

create or replace function store.admin_ops_dashboard(
  p_from date default null,
  p_to   date default null
) returns jsonb
language plpgsql
security definer
set search_path = store, public
as $$
declare
  result jsonb;
  d_to   date := coalesce(p_to, current_date);
  d_from date := coalesce(p_from, current_date - 29);
  tmp    date;
  span   integer;
  prev_to date;
  prev_from date;
  ndays  integer;
begin
  if not store.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if d_from > d_to then
    tmp := d_from; d_from := d_to; d_to := tmp;
  end if;
  -- clamp very long ranges to keep the daily series bounded
  if d_to - d_from > 366 then
    d_from := d_to - 366;
  end if;

  ndays := d_to - d_from + 1;
  span  := d_to - d_from;
  prev_to   := d_from - 1;
  prev_from := prev_to - span;

  with prod_cost as (
    select
      p.id, p.name_he, p.category_id, p.stock, p.price, p.reorder_point, p.deleted_at,
      case when p.cost > 0 then p.cost
           else coalesce(
             (select avg(sm.unit_cost) from store.stock_movements sm
                where sm.product_id = p.id and sm.reason = 'purchase' and sm.unit_cost is not null),
             (select avg(poi.unit_cost) from store.purchase_order_items poi
                where poi.product_id = p.id and poi.unit_cost is not null),
             0)
      end as cost
    from store.products p
  ),
  cur_items as (
    select oi.order_id, oi.product_id, oi.qty, oi.line_total, oi.name_he,
           o.created_at, coalesce(pc.cost, 0) as ucost, pc.category_id
    from store.order_items oi
    join store.orders o on o.id = oi.order_id
    left join prod_cost pc on pc.id = oi.product_id
    where o.created_at::date between d_from and d_to
  ),
  velocity as (
    select product_id, sum(qty)::numeric / ndays as per_day
    from cur_items group by product_id
  )
  select jsonb_build_object(
    'generated_at', now(),
    'range', jsonb_build_object(
      'from', d_from, 'to', d_to, 'days', ndays,
      'prev_from', prev_from, 'prev_to', prev_to
    ),
    'kpi', jsonb_build_object(
      'revenue', (select coalesce(sum(line_total), 0) from cur_items),
      'profit',  (select coalesce(sum(line_total - qty * ucost), 0) from cur_items),
      'cogs',    (select coalesce(sum(qty * ucost), 0) from cur_items),
      'orders',  (select count(distinct order_id) from cur_items),
      'units',   (select coalesce(sum(qty), 0) from cur_items)
    ),
    'prev', jsonb_build_object(
      'revenue', (select coalesce(sum(oi.line_total), 0)
                    from store.order_items oi join store.orders o on o.id = oi.order_id
                    where o.created_at::date between prev_from and prev_to),
      'profit',  (select coalesce(sum(oi.line_total - oi.qty * coalesce(pc.cost, 0)), 0)
                    from store.order_items oi
                    join store.orders o on o.id = oi.order_id
                    left join prod_cost pc on pc.id = oi.product_id
                    where o.created_at::date between prev_from and prev_to)
    ),
    'counts', jsonb_build_object(
      'orders_pending',   (select count(*) from store.orders where status = 'pending'),
      'dealers_pending',  (select count(*) from store.profiles where status = 'pending'),
      'quotes_pending',   (select count(*) from store.quotes where status in ('draft', 'sent')),
      'products_low',     (select count(*) from prod_cost where deleted_at is null and reorder_point > 0 and stock <= reorder_point),
      'orders_today',     (select count(*) from store.orders where created_at >= date_trunc('day', now())),
      'dealers_total',    (select count(*) from store.profiles where role = 'dealer'),
      'products_total',   (select count(*) from store.products where deleted_at is null),
      'inventory_value',  (select coalesce(sum(stock * cost), 0) from prod_cost where deleted_at is null),
      'inventory_retail', (select coalesce(sum(stock * price), 0) from prod_cost where deleted_at is null)
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
          'revenue', coalesce((select sum(ci.line_total) from cur_items ci where ci.created_at::date = g::date), 0),
          'profit',  coalesce((select sum(ci.line_total - ci.qty * ci.ucost) from cur_items ci where ci.created_at::date = g::date), 0),
          'orders',  coalesce((select count(distinct ci.order_id) from cur_items ci where ci.created_at::date = g::date), 0)
        ) as row
        from generate_series(d_from, d_to, '1 day') g
      ) t
    ),
    'top_products', (
      select coalesce(jsonb_agg(row order by (row->>'revenue')::numeric desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'name', max(name_he),
          'qty', sum(qty),
          'revenue', sum(line_total),
          'profit', sum(line_total - qty * ucost),
          'margin', case when sum(line_total) > 0
                         then round(100 * sum(line_total - qty * ucost) / sum(line_total), 1) else 0 end
        ) as row
        from cur_items group by product_id
        order by sum(line_total) desc limit 8
      ) t
    ),
    'categories', (
      select coalesce(jsonb_agg(row order by (row->>'revenue')::numeric desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'name', coalesce(max(c.name_he), 'ללא קטגוריה'),
          'revenue', sum(ci.line_total),
          'profit', sum(ci.line_total - ci.qty * ci.ucost),
          'margin', case when sum(ci.line_total) > 0
                         then round(100 * sum(ci.line_total - ci.qty * ci.ucost) / sum(ci.line_total), 1) else 0 end
        ) as row
        from cur_items ci
        left join store.categories c on c.id = ci.category_id
        group by ci.category_id
      ) t
    ),
    'low_stock', (
      select coalesce(jsonb_agg(row order by (row->>'days_left') is null, (row->>'days_left')::numeric), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'name', pc.name_he, 'stock', pc.stock, 'reorder', pc.reorder_point,
          'per_day', round(coalesce(v.per_day, 0), 2),
          'days_left', case when coalesce(v.per_day, 0) > 0 then round(pc.stock / v.per_day) else null end
        ) as row
        from prod_cost pc
        left join velocity v on v.product_id = pc.id
        where pc.deleted_at is null and pc.reorder_point > 0 and pc.stock <= pc.reorder_point
        limit 10
      ) t
    ),
    'activity', (
      select coalesce(jsonb_agg(row order by (row->>'at') desc), '[]'::jsonb)
      from (
        (select jsonb_build_object(
            'type', 'order', 'at', o.created_at,
            'title', coalesce(pr.company, pr.full_name, 'הזמנה'),
            'detail', o.order_number, 'amount', o.total, 'status', o.status) as row
         from store.orders o
         left join store.profiles pr on pr.id = o.dealer_id
         order by o.created_at desc limit 8)
        union all
        (select jsonb_build_object(
            'type', 'dealer', 'at', pr.created_at,
            'title', coalesce(pr.company, pr.full_name, 'סוחר חדש'),
            'detail', pr.status, 'amount', null, 'status', pr.status) as row
         from store.profiles pr where pr.role = 'dealer'
         order by pr.created_at desc limit 5)
      ) t
    ),
    'goal', jsonb_build_object(
      'target', coalesce((select target from store.sales_targets where month = date_trunc('month', now())::date), 0),
      'actual', coalesce((select sum(total) from store.orders where created_at >= date_trunc('month', now())), 0)
    )
  ) into result;

  return result;
end;
$$;

create or replace function public.admin_ops_dashboard(p_from date default null, p_to date default null)
returns jsonb
language sql security definer set search_path = store, public
as $$ select store.admin_ops_dashboard(p_from, p_to); $$;

grant execute on function store.admin_ops_dashboard(date, date)  to authenticated;
grant execute on function public.admin_ops_dashboard(date, date) to authenticated;
