-- Monthly sales targets (feature: goals & progress on the ops dashboard).
-- One row per month (first-of-month date) holding the revenue target.

create table if not exists store.sales_targets (
  month      date primary key,
  target     numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table store.sales_targets enable row level security;

drop policy if exists tgt_public_read on store.sales_targets;
create policy tgt_public_read on store.sales_targets
  for select using (true);

drop policy if exists tgt_admin_write on store.sales_targets;
create policy tgt_admin_write on store.sales_targets
  for all using ((select store.is_admin())) with check ((select store.is_admin()));

grant select, insert, update, delete on store.sales_targets to anon, authenticated;

-- Public passthrough view (RLS applied as caller).
create or replace view public.sales_targets
  with (security_invoker = on)
as
  select month, target, updated_at from store.sales_targets;
