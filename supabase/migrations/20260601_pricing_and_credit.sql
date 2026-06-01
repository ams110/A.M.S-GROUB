-- Phase 3: per-type pricing, per-customer overrides, credit terms, PO number.
-- Applied to the Supabase project; kept here for version control / review.

alter table store.products add column if not exists price_contractor numeric not null default 0;
update store.products set price_contractor = price where price_contractor = 0;

alter table store.orders add column if not exists po_number text;

alter table store.profiles add column if not exists credit_limit numeric not null default 0;
alter table store.profiles add column if not exists payment_terms text not null default 'immediate'
  check (payment_terms in ('immediate','net30','net60'));

create table if not exists store.customer_prices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references store.profiles(id) on delete cascade,
  product_id uuid not null references store.products(id) on delete cascade,
  price numeric not null,
  created_at timestamptz not null default now(),
  unique (profile_id, product_id)
);
alter table store.customer_prices enable row level security;
drop policy if exists cp_admin_all on store.customer_prices;
create policy cp_admin_all on store.customer_prices for all
  using (store.is_admin()) with check (store.is_admin());
drop policy if exists cp_read_own on store.customer_prices;
create policy cp_read_own on store.customer_prices for select
  using (profile_id = auth.uid());

-- Effective price per product for the current user: override > contractor > base.
create or replace function store.my_prices()
returns table(product_id uuid, price numeric)
language sql stable security definer set search_path to 'store','public' as $$
  select p.id,
    case
      when cp.price is not null then cp.price
      when prof.customer_type = 'contractor'
        then coalesce(nullif(p.price_contractor, 0), p.price)
      else p.price
    end
  from store.products p
  left join store.profiles prof on prof.id = auth.uid()
  left join store.customer_prices cp
    on cp.product_id = p.id and cp.profile_id = auth.uid()
  where p.deleted_at is null;
$$;
grant execute on function store.my_prices() to anon, authenticated;

-- place_order rebuilt: effective pricing, PO number, and a 'sale' ledger entry
-- per line. (See repo history / the function body in the database.)
drop function if exists store.place_order(jsonb,text,text,text,text,text,text);
-- The full body is created via the pricing_and_credit migration in the project.
