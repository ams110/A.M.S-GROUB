-- Self-service quote acceptance.
--
-- store.convert_quote_to_order is admin-only (raises NOT_AUTHORIZED otherwise).
-- This lets a dealer accept *their own* open quote and turn it into an order,
-- so they can close the deal without waiting for the importer. Ownership,
-- validity (not converted/rejected/expired) and stock are all checked
-- server-side; pricing comes straight from the quoted line prices.
--
-- Mirrors the existing wrapper pattern: store.fn (SECURITY DEFINER) + a
-- public.fn wrapper so PostgREST (public schema only) can call it.

create or replace function store.accept_my_quote(p_quote_id uuid)
 returns store.orders language plpgsql security definer set search_path to 'store','public'
as $$
declare
  v_quote store.quotes; v_cust store.profiles; r record;
  v_order store.orders; v_subtotal numeric(12,2) := 0; v_new_stock integer;
begin
  select * into v_quote from store.quotes where id = p_quote_id;
  if v_quote.id is null then raise exception 'QUOTE_NOT_FOUND'; end if;
  if v_quote.customer_id is null or v_quote.customer_id <> auth.uid() then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_quote.order_id is not null then raise exception 'ALREADY_CONVERTED'; end if;
  if v_quote.status in ('rejected','expired','converted') then raise exception 'QUOTE_NOT_OPEN'; end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
    raise exception 'QUOTE_EXPIRED';
  end if;

  select * into v_cust from store.profiles where id = v_quote.customer_id;
  if v_cust.status <> 'approved' then raise exception 'DEALER_NOT_APPROVED'; end if;

  -- Validate stock for every line before creating anything (all-or-nothing).
  for r in select * from store.quote_items where quote_id = p_quote_id loop
    if r.product_id is not null then
      select stock into v_new_stock from store.products where id = r.product_id and deleted_at is null;
      if not found then raise exception 'PRODUCT_NOT_FOUND: %', r.name_he; end if;
      if v_new_stock < r.qty then raise exception 'INSUFFICIENT_STOCK: %', r.name_he; end if;
    end if;
  end loop;

  insert into store.orders (dealer_id, payment_method, ship_name, ship_phone, ship_city, ship_address, notes)
  values (v_quote.customer_id, 'bank_transfer', v_cust.full_name, v_cust.phone, v_cust.city, v_cust.address,
          'נוצר מהצעת מחיר ' || v_quote.quote_number)
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

grant execute on function store.accept_my_quote(uuid) to authenticated;

create or replace function public.accept_my_quote(p_quote_id uuid)
 returns store.orders language sql security definer set search_path to 'store','public'
as $$ select * from store.accept_my_quote(p_quote_id); $$;

grant execute on function public.accept_my_quote(uuid) to authenticated;
