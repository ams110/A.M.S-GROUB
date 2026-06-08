-- Enable Supabase Realtime for store.orders so the admin Operations Center
-- (OpsCenter) refreshes live on new/changed orders instead of waiting for the
-- 60s poll. Realtime still enforces RLS on the subscriber, so only admins
-- (store.is_admin()) receive the change events — same as the table's policies.
--
-- Safe to run more than once: adding a table that is already a member of the
-- publication raises an error, so we guard with a catalog check.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'store'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table store.orders;
  end if;
end $$;
