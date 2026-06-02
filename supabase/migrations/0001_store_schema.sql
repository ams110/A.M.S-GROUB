-- =============================================================================
-- Tiandy Store — complete `store` schema for a FRESH Supabase project.
-- Run this in the new project's SQL Editor FIRST, then run 0002_store_data.sql.
-- (Generated from the live database; recreates every table, function, policy.)
-- =============================================================================

create schema if not exists store;
grant usage on schema store to anon, authenticated;

-- ----- Sequences -----
create sequence if not exists store.order_seq start 100001;
create sequence if not exists store.quote_seq start 1;
create sequence if not exists store.invoice_seq start 1;

-- ===================== Tables (dependency order) =====================

create table store.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table store.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_he text not null,
  sort integer not null default 0,
  image_url text,
  created_at timestamptz not null default now()
);

create table store.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table store.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'dealer' check (role in ('dealer','admin')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  full_name text,
  phone text,
  company text,
  city text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  customer_type text not null default 'dealer' check (customer_type in ('dealer','contractor')),
  credit_limit numeric not null default 0,
  payment_terms text not null default 'immediate' check (payment_terms in ('immediate','net30','net60'))
);

create table store.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references store.categories(id) on delete set null,
  slug text not null unique,
  name_he text not null,
  short_desc_he text,
  description_he text,
  image_url text,
  datasheet_url text,
  specs jsonb not null default '{}'::jsonb,
  is_featured boolean not null default false,
  sort integer not null default 0,
  sku text,
  price numeric(12,2) not null default 0,
  currency text not null default 'ILS',
  stock integer not null default 0,
  min_order_qty integer not null default 1,
  is_orderable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  reorder_point integer not null default 0,
  price_contractor numeric not null default 0
);

create table store.banners (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  link_url text,
  title_he text,
  position text not null default 'hero',
  is_active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table store.settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

create table store.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('TND-' || nextval('store.order_seq')),
  dealer_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','confirmed','paid','shipped','delivered','cancelled')),
  payment_method text not null check (payment_method in ('card','bank_transfer','cod')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  currency text not null default 'ILS',
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  ship_name text,
  ship_phone text,
  ship_city text,
  ship_address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  po_number text
);

create table store.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references store.orders(id) on delete cascade,
  product_id uuid references store.products(id) on delete set null,
  name_he text not null,
  sku text,
  unit_price numeric(12,2) not null,
  qty integer not null check (qty > 0),
  line_total numeric(12,2) not null
);

create table store.customer_prices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references store.profiles(id) on delete cascade,
  product_id uuid not null references store.products(id) on delete cascade,
  price numeric not null,
  created_at timestamptz not null default now(),
  unique (profile_id, product_id)
);

create table store.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references store.products(id) on delete cascade,
  warehouse_id uuid references store.warehouses(id),
  delta integer not null,
  reason text not null check (reason in ('purchase','sale','adjustment','return','initial')),
  note text,
  reference text,
  unit_cost numeric,
  balance_after integer,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index stock_movements_product_idx on store.stock_movements (product_id, created_at desc);

create table store.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text,
  supplier_id uuid references store.suppliers(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','ordered','received','cancelled')),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create table store.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references store.purchase_orders(id) on delete cascade,
  product_id uuid not null references store.products(id),
  qty integer not null check (qty > 0),
  unit_cost numeric not null default 0
);

create table store.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique default ('Q-' || nextval('store.quote_seq')),
  customer_id uuid references store.profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired','converted')),
  notes text,
  valid_until date,
  order_id uuid references store.orders(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table store.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references store.quotes(id) on delete cascade,
  product_id uuid references store.products(id) on delete set null,
  name_he text not null,
  sku text,
  unit_price numeric not null default 0,
  qty integer not null default 1 check (qty > 0),
  line_total numeric not null default 0
);

create table store.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  order_id uuid not null unique references store.orders(id) on delete cascade,
  customer_id uuid,
  vat_rate numeric not null,
  subtotal numeric not null,
  vat numeric not null,
  total numeric not null,
  issued_at timestamptz not null default now(),
  created_by uuid
);

-- ===================== Functions =====================

create or replace function store.is_admin()
 returns boolean language sql stable security definer set search_path to 'store','public'
as $$ select exists (select 1 from store.profiles where id = auth.uid() and role = 'admin'); $$;

create or replace function store.is_approved_dealer()
 returns boolean language sql stable security definer set search_path to 'store','public'
as $$ select exists (select 1 from store.profiles where id = auth.uid() and status = 'approved'); $$;

create or replace function store.handle_new_user()
 returns trigger language plpgsql security definer set search_path to 'store','public'
as $$
begin
  insert into store.profiles (id, full_name, phone, company, customer_type)
  values (new.id,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'phone',
          new.raw_user_meta_data->>'company',
          coalesce(new.raw_user_meta_data->>'customer_type', 'dealer'))
  on conflict (id) do nothing;
  return new;
end; $$;

create or replace function store.my_prices()
 returns table(product_id uuid, price numeric) language sql stable security definer set search_path to 'store','public'
as $$
  select p.id,
    case
      when cp.price is not null then cp.price
      when prof.customer_type = 'contractor'
        then coalesce(nullif(p.price_contractor, 0), p.price)
      else p.price
    end
  from store.products p
  left join store.profiles prof on prof.id = auth.uid()
  left join store.customer_prices cp on cp.product_id = p.id and cp.profile_id = auth.uid()
  where p.deleted_at is null;
$$;

create or replace function store.apply_stock_movement(p_product_id uuid, p_delta integer, p_reason text, p_note text default null::text, p_reference text default null::text, p_unit_cost numeric default null::numeric, p_warehouse_id uuid default null::uuid)
 returns store.stock_movements language plpgsql security definer set search_path to 'store','public'
as $$
declare
  v_wh uuid; v_new_stock integer; v_row store.stock_movements;
begin
  if not store.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_reason not in ('purchase','sale','adjustment','return','initial') then raise exception 'BAD_REASON'; end if;
  v_wh := coalesce(p_warehouse_id, (select id from store.warehouses where is_default limit 1));
  update store.products set stock = stock + p_delta, updated_at = now() where id = p_product_id returning stock into v_new_stock;
  if v_new_stock is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  insert into store.stock_movements (product_id, warehouse_id, delta, reason, note, reference, unit_cost, balance_after, created_by)
  values (p_product_id, v_wh, p_delta, p_reason, p_note, p_reference, p_unit_cost, v_new_stock, auth.uid())
  returning * into v_row;
  return v_row;
end $$;

create or replace function store.receive_purchase_order(p_po_id uuid)
 returns void language plpgsql security definer set search_path to 'store','public'
as $$
declare v_po store.purchase_orders; r record;
begin
  if not store.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into v_po from store.purchase_orders where id = p_po_id;
  if v_po.id is null then raise exception 'PO_NOT_FOUND'; end if;
  if v_po.status = 'received' then raise exception 'ALREADY_RECEIVED'; end if;
  for r in select * from store.purchase_order_items where po_id = p_po_id loop
    perform store.apply_stock_movement(r.product_id, r.qty, 'purchase', 'קליטת הזמנת רכש', coalesce(v_po.po_number, p_po_id::text), r.unit_cost, null);
  end loop;
  update store.purchase_orders set status = 'received', received_at = now() where id = p_po_id;
end $$;

create or replace function store.place_order(p_items jsonb, p_payment_method text, p_ship_name text, p_ship_phone text, p_ship_city text, p_ship_address text, p_notes text default null::text, p_po_number text default null::text)
 returns store.orders language plpgsql security definer set search_path to 'store','public'
as $$
declare
  v_order store.orders; v_item jsonb; v_product store.products;
  v_qty integer; v_subtotal numeric(12,2) := 0;
  v_type text; v_price numeric; v_new_stock integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not store.is_approved_dealer() then raise exception 'DEALER_NOT_APPROVED'; end if;
  if p_payment_method not in ('card','bank_transfer','cod') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_CART'; end if;
  select customer_type into v_type from store.profiles where id = auth.uid();
  insert into store.orders (dealer_id, payment_method, ship_name, ship_phone, ship_city, ship_address, notes, po_number)
  values (auth.uid(), p_payment_method, p_ship_name, p_ship_phone, p_ship_city, p_ship_address, p_notes, p_po_number)
  returning * into v_order;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'INVALID_QTY'; end if;
    select * into v_product from store.products where id = (v_item->>'product_id')::uuid and deleted_at is null;
    if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
    if not v_product.is_orderable then raise exception 'PRODUCT_NOT_ORDERABLE: %', v_product.name_he; end if;
    if v_qty < v_product.min_order_qty then raise exception 'BELOW_MIN_ORDER: %', v_product.name_he; end if;
    if v_product.stock < v_qty then raise exception 'INSUFFICIENT_STOCK: %', v_product.name_he; end if;
    select cp.price into v_price from store.customer_prices cp where cp.profile_id = auth.uid() and cp.product_id = v_product.id;
    if v_price is null then
      if v_type = 'contractor' then v_price := coalesce(nullif(v_product.price_contractor, 0), v_product.price);
      else v_price := v_product.price; end if;
    end if;
    update store.products set stock = stock - v_qty, updated_at = now() where id = v_product.id returning stock into v_new_stock;
    insert into store.order_items (order_id, product_id, name_he, sku, unit_price, qty, line_total)
    values (v_order.id, v_product.id, v_product.name_he, v_product.sku, v_price, v_qty, v_price * v_qty);
    insert into store.stock_movements (product_id, warehouse_id, delta, reason, reference, balance_after, created_by)
    values (v_product.id, (select id from store.warehouses where is_default limit 1), -v_qty, 'sale', v_order.order_number, v_new_stock, auth.uid());
    v_subtotal := v_subtotal + (v_price * v_qty);
  end loop;
  update store.orders set subtotal = v_subtotal, total = v_subtotal, updated_at = now() where id = v_order.id returning * into v_order;
  return v_order;
end; $$;

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

create or replace function store.issue_invoice(p_order_id uuid)
 returns store.invoices language plpgsql security definer set search_path to 'store','public'
as $$
declare v_existing store.invoices; v_order store.orders; v_rate numeric; v_subtotal numeric; v_vat numeric; v_row store.invoices;
begin
  if not store.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into v_existing from store.invoices where order_id = p_order_id;
  if found then return v_existing; end if;
  select * into v_order from store.orders where id = p_order_id;
  if v_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  v_rate := coalesce((select nullif(value,'')::numeric from store.settings where key = 'vat_rate'), 17);
  v_subtotal := v_order.total;
  v_vat := round(v_subtotal * v_rate / 100, 2);
  insert into store.invoices (invoice_number, order_id, customer_id, vat_rate, subtotal, vat, total, created_by)
  values ('INV-' || nextval('store.invoice_seq'), p_order_id, v_order.dealer_id, v_rate, v_subtotal, v_vat, v_subtotal + v_vat, auth.uid())
  returning * into v_row;
  return v_row;
end $$;

-- ===================== Trigger: create profile on signup =====================
drop trigger if exists on_auth_user_created_store on auth.users;
create trigger on_auth_user_created_store
  after insert on auth.users for each row execute function store.handle_new_user();

-- ===================== Row Level Security =====================
alter table store.warehouses            enable row level security;
alter table store.categories            enable row level security;
alter table store.suppliers             enable row level security;
alter table store.profiles              enable row level security;
alter table store.products              enable row level security;
alter table store.banners               enable row level security;
alter table store.settings              enable row level security;
alter table store.orders                enable row level security;
alter table store.order_items           enable row level security;
alter table store.customer_prices       enable row level security;
alter table store.stock_movements       enable row level security;
alter table store.purchase_orders       enable row level security;
alter table store.purchase_order_items  enable row level security;
alter table store.quotes                enable row level security;
alter table store.quote_items           enable row level security;
alter table store.invoices              enable row level security;

create policy ban_admin_write on store.banners for all to public using (store.is_admin()) with check (store.is_admin());
create policy ban_public_read on store.banners for select to public using (true);

create policy cat_admin_write on store.categories for all to public using (store.is_admin()) with check (store.is_admin());
create policy cat_public_read on store.categories for select to public using (true);

create policy cp_admin_all on store.customer_prices for all to public using (store.is_admin()) with check (store.is_admin());
create policy cp_read_own on store.customer_prices for select to public using (profile_id = auth.uid());

create policy inv_admin_all on store.invoices for all to public using (store.is_admin()) with check (store.is_admin());
create policy inv_read_own on store.invoices for select to public using (customer_id = auth.uid());

create policy oit_select_own on store.order_items for select to public
  using (store.is_admin() or exists (select 1 from store.orders o where o.id = order_items.order_id and o.dealer_id = auth.uid()));

create policy ord_admin_update on store.orders for update to public using (store.is_admin()) with check (store.is_admin());
create policy ord_select_own on store.orders for select to public using (dealer_id = auth.uid() or store.is_admin());

create policy prod_admin_read on store.products for select to public using (store.is_admin());
create policy prod_admin_write on store.products for all to public using (store.is_admin()) with check (store.is_admin());
create policy prod_public_read on store.products for select to public using (deleted_at is null);

create policy prof_admin_all on store.profiles for all to public using (store.is_admin()) with check (store.is_admin());
create policy prof_select_own on store.profiles for select to public using (id = auth.uid() or store.is_admin());
create policy prof_update_own on store.profiles for update to public
  using (id = auth.uid() or store.is_admin())
  with check (store.is_admin() or (id = auth.uid()
    and role = (select role from store.profiles p1 where p1.id = auth.uid())
    and status = (select status from store.profiles p1 where p1.id = auth.uid())));

create policy purchase_order_items_admin_all on store.purchase_order_items for all to public using (store.is_admin()) with check (store.is_admin());
create policy purchase_orders_admin_all on store.purchase_orders for all to public using (store.is_admin()) with check (store.is_admin());

create policy qi_admin_all on store.quote_items for all to public using (store.is_admin()) with check (store.is_admin());
create policy qi_read_own on store.quote_items for select to public
  using (exists (select 1 from store.quotes q where q.id = quote_items.quote_id and q.customer_id = auth.uid()));

create policy q_admin_all on store.quotes for all to public using (store.is_admin()) with check (store.is_admin());
create policy q_read_own on store.quotes for select to public using (customer_id = auth.uid());

create policy set_admin_write on store.settings for all to public using (store.is_admin()) with check (store.is_admin());
create policy set_public_read on store.settings for select to public using (true);

create policy stock_movements_admin_all on store.stock_movements for all to public using (store.is_admin()) with check (store.is_admin());
create policy suppliers_admin_all on store.suppliers for all to public using (store.is_admin()) with check (store.is_admin());
create policy warehouses_admin_all on store.warehouses for all to public using (store.is_admin()) with check (store.is_admin());

-- ===================== Grants (RLS still applies on top) =====================
grant select, insert, update, delete on all tables in schema store to anon, authenticated;
grant usage, select on all sequences in schema store to anon, authenticated;

grant execute on function store.is_admin() to anon, authenticated;
grant execute on function store.is_approved_dealer() to anon, authenticated;
grant execute on function store.my_prices() to anon, authenticated;
grant execute on function store.place_order(jsonb,text,text,text,text,text,text,text) to authenticated;
grant execute on function store.apply_stock_movement(uuid,integer,text,text,text,numeric,uuid) to authenticated;
grant execute on function store.receive_purchase_order(uuid) to authenticated;
grant execute on function store.convert_quote_to_order(uuid) to authenticated;
grant execute on function store.issue_invoice(uuid) to authenticated;

-- ===================== Storage bucket for catalog images =====================
insert into storage.buckets (id, name, public) values ('store-media','store-media', true)
  on conflict (id) do nothing;
drop policy if exists "store_media_admin_insert" on storage.objects;
create policy "store_media_admin_insert" on storage.objects for insert
  with check (bucket_id = 'store-media' and store.is_admin());
drop policy if exists "store_media_admin_update" on storage.objects;
create policy "store_media_admin_update" on storage.objects for update
  using (bucket_id = 'store-media' and store.is_admin()) with check (bucket_id = 'store-media' and store.is_admin());
drop policy if exists "store_media_admin_delete" on storage.objects;
create policy "store_media_admin_delete" on storage.objects for delete
  using (bucket_id = 'store-media' and store.is_admin());

notify pgrst, 'reload schema';
