-- Guard convert_quote_to_order against overselling.
-- The original function did `stock = stock - qty` unconditionally, which let the
-- conversion silently drive product stock negative (selling goods we don't have).
-- This recreates it with an up-front availability check that aborts the whole
-- conversion with a structured INSUFFICIENT_STOCK error the client can parse.
create or replace function store.convert_quote_to_order(p_quote_id uuid)
 returns store.orders language plpgsql security definer set search_path to 'store','public'
as $$
declare
  v_quote store.quotes; v_cust store.profiles; r record;
  v_order store.orders; v_subtotal numeric(12,2) := 0; v_new_stock integer;
begin
  if not store.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into v_quote from store.quotes where id = p_quote_id;
  if v_quote.id is null then raise exception 'QUOTE_NOT_FOUND'; end if;
  if v_quote.order_id is not null then raise exception 'ALREADY_CONVERTED'; end if;
  if v_quote.customer_id is null then raise exception 'NO_CUSTOMER'; end if;

  -- Stock availability pre-check: refuse to convert if any line would oversell.
  -- Error format: INSUFFICIENT_STOCK:<name>:<available>:<requested>
  for r in
    select qi.name_he, qi.qty, p.stock as cur_stock
    from store.quote_items qi
    join store.products p on p.id = qi.product_id
    where qi.quote_id = p_quote_id and qi.product_id is not null
  loop
    if r.cur_stock < r.qty then
      raise exception 'INSUFFICIENT_STOCK:%:%:%', r.name_he, r.cur_stock, r.qty;
    end if;
  end loop;

  select * into v_cust from store.profiles where id = v_quote.customer_id;
  insert into store.orders (dealer_id, payment_method, ship_name, ship_phone, ship_city, ship_address, notes)
  values (v_quote.customer_id, 'bank_transfer', v_cust.full_name, v_cust.phone, v_cust.city, v_cust.address, 'נוצר מהצעת מחיר ' || v_quote.quote_number)
  returning * into v_order;
  for r in select * from store.quote_items where quote_id = p_quote_id loop
    if r.product_id is not null then
      update store.products set stock = stock - r.qty, updated_at = now() where id = r.product_id returning stock into v_new_stock;
      insert into store.stock_movements (product_id, warehouse_id, delta, reason, reference, balance_after, created_by)
      values (r.product_id, (select id from store.warehouses where is_default limit 1), -r.qty, 'sale', v_order.order_number, v_new_stock, auth.uid());
    end if;
    insert into store.order_items (order_id, product_id, name_he, sku, unit_price, qty, line_total)
    values (v_order.id, r.product_id, r.name_he, r.sku, r.unit_price, r.qty, r.unit_price * r.qty);
    v_subtotal := v_subtotal + (r.unit_price * r.qty);
  end loop;
  update store.orders set subtotal = v_subtotal, total = v_subtotal, updated_at = now() where id = v_order.id returning * into v_order;
  update store.quotes set status = 'converted', order_id = v_order.id where id = p_quote_id;
  return v_order;
end $$;
grant execute on function store.convert_quote_to_order(uuid) to authenticated;
