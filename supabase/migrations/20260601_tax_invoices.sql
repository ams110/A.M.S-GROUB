-- Phase 4a: tax invoices (חשבונית מס). Applied to the Supabase project; kept
-- here for version control / review.

insert into store.settings (key, value) values
  ('vat_rate', '17'),
  ('business_name', ''),
  ('business_tax_id', ''),
  ('business_address', ''),
  ('business_phone', ''),
  ('business_email', '')
on conflict (key) do nothing;

create sequence if not exists store.invoice_seq;

create table if not exists store.invoices (
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

alter table store.invoices enable row level security;
drop policy if exists inv_admin_all on store.invoices;
create policy inv_admin_all on store.invoices for all
  using (store.is_admin()) with check (store.is_admin());
drop policy if exists inv_read_own on store.invoices;
create policy inv_read_own on store.invoices for select
  using (customer_id = auth.uid());

-- Issue (or return existing) tax invoice for an order. Admin only.
-- VAT is added on top of the order total (prices are stored excl. VAT).
create or replace function store.issue_invoice(p_order_id uuid)
returns store.invoices
language plpgsql security definer set search_path to 'store','public' as $$
declare
  v_existing store.invoices; v_order store.orders;
  v_rate numeric; v_subtotal numeric; v_vat numeric; v_row store.invoices;
begin
  if not store.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into v_existing from store.invoices where order_id = p_order_id;
  if found then return v_existing; end if;
  select * into v_order from store.orders where id = p_order_id;
  if v_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  v_rate := coalesce((select nullif(value,'')::numeric from store.settings where key='vat_rate'), 17);
  v_subtotal := v_order.total;
  v_vat := round(v_subtotal * v_rate / 100, 2);
  insert into store.invoices
    (invoice_number, order_id, customer_id, vat_rate, subtotal, vat, total, created_by)
  values
    ('INV-' || nextval('store.invoice_seq'), p_order_id, v_order.dealer_id,
     v_rate, v_subtotal, v_vat, v_subtotal + v_vat, auth.uid())
  returning * into v_row;
  return v_row;
end $$;
grant execute on function store.issue_invoice(uuid) to authenticated;
