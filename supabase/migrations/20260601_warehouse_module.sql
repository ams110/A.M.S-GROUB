-- Warehouse module (single warehouse, expandable). Applied to the Supabase
-- project; kept here for version control / review.
--
-- Tables: warehouses, stock_movements, suppliers, purchase_orders,
--         purchase_order_items  (+ products.reorder_point)
-- Functions: store.apply_stock_movement(), store.receive_purchase_order()
-- All tables are admin-only via RLS (store.is_admin()).

create table if not exists store.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
insert into store.warehouses (name, is_default)
select 'מחסן ראשי', true
where not exists (select 1 from store.warehouses);

alter table store.products
  add column if not exists reorder_point integer not null default 0;

create table if not exists store.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references store.products(id) on delete cascade,
  warehouse_id uuid references store.warehouses(id),
  delta integer not null,
  reason text not null check (reason in
    ('purchase','sale','adjustment','return','initial')),
  note text,
  reference text,
  unit_cost numeric,
  balance_after integer,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_product_idx
  on store.stock_movements (product_id, created_at desc);

create table if not exists store.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text, phone text, email text, notes text,
  created_at timestamptz not null default now()
);

create table if not exists store.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text,
  supplier_id uuid references store.suppliers(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','ordered','received','cancelled')),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create table if not exists store.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references store.purchase_orders(id) on delete cascade,
  product_id uuid not null references store.products(id),
  qty integer not null check (qty > 0),
  unit_cost numeric not null default 0
);

-- RLS: admin-only on every warehouse table.
do $$
declare t text;
begin
  foreach t in array array['warehouses','stock_movements','suppliers',
                           'purchase_orders','purchase_order_items']
  loop
    execute format('alter table store.%I enable row level security', t);
    execute format('drop policy if exists %I on store.%I', t||'_admin_all', t);
    execute format(
      'create policy %I on store.%I for all using (store.is_admin()) with check (store.is_admin())',
      t||'_admin_all', t);
  end loop;
end $$;

-- Atomic stock change + ledger entry (admin only).
create or replace function store.apply_stock_movement(
  p_product_id uuid, p_delta integer, p_reason text,
  p_note text default null, p_reference text default null,
  p_unit_cost numeric default null, p_warehouse_id uuid default null
) returns store.stock_movements
language plpgsql security definer set search_path to 'store','public' as $$
declare
  v_wh uuid;
  v_new_stock integer;
  v_row store.stock_movements;
begin
  if not store.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_reason not in ('purchase','sale','adjustment','return','initial') then
    raise exception 'BAD_REASON';
  end if;
  v_wh := coalesce(p_warehouse_id,
                   (select id from store.warehouses where is_default limit 1));
  update store.products set stock = stock + p_delta, updated_at = now()
   where id = p_product_id returning stock into v_new_stock;
  if v_new_stock is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  insert into store.stock_movements
    (product_id, warehouse_id, delta, reason, note, reference, unit_cost,
     balance_after, created_by)
  values
    (p_product_id, v_wh, p_delta, p_reason, p_note, p_reference, p_unit_cost,
     v_new_stock, auth.uid())
  returning * into v_row;
  return v_row;
end $$;

-- Receive a purchase order into stock and mark it received (admin only).
create or replace function store.receive_purchase_order(p_po_id uuid)
returns void
language plpgsql security definer set search_path to 'store','public' as $$
declare v_po store.purchase_orders; r record;
begin
  if not store.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into v_po from store.purchase_orders where id = p_po_id;
  if v_po.id is null then raise exception 'PO_NOT_FOUND'; end if;
  if v_po.status = 'received' then raise exception 'ALREADY_RECEIVED'; end if;
  for r in select * from store.purchase_order_items where po_id = p_po_id loop
    perform store.apply_stock_movement(
      r.product_id, r.qty, 'purchase', 'קליטת הזמנת רכש',
      coalesce(v_po.po_number, p_po_id::text), r.unit_cost, null);
  end loop;
  update store.purchase_orders
     set status = 'received', received_at = now() where id = p_po_id;
end $$;

grant execute on function store.apply_stock_movement(uuid,integer,text,text,text,numeric,uuid) to authenticated;
grant execute on function store.receive_purchase_order(uuid) to authenticated;
