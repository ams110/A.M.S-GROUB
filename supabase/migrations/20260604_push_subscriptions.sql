-- Web Push subscriptions (feature: push notifications to admins).
-- Each row is one browser/device subscription owned by a profile.
--
-- NOTE: `public.push_subscriptions` is already taken by another app sharing this
-- Supabase project, so we DON'T create a same-named public view. The browser
-- talks to this table only through the RPC wrappers below; Edge Functions use
-- service_role + .schema('store').

create table if not exists store.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references store.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_profile_idx
  on store.push_subscriptions (profile_id);

alter table store.push_subscriptions enable row level security;

drop policy if exists push_select_own on store.push_subscriptions;
create policy push_select_own on store.push_subscriptions
  for select using (profile_id = (select auth.uid()) or (select store.is_admin()));

drop policy if exists push_modify_own on store.push_subscriptions;
create policy push_modify_own on store.push_subscriptions
  for all using (profile_id = (select auth.uid()) or (select store.is_admin()))
  with check (profile_id = (select auth.uid()));

grant select, insert, update, delete on store.push_subscriptions to authenticated;

-- ── RPC wrappers (browser calls these; default schema is public) ─────────────

create or replace function store.push_subscribe(
  p_endpoint text, p_p256dh text, p_auth text, p_ua text default null
) returns void
language plpgsql security definer set search_path = store, public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into store.push_subscriptions (profile_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_ua)
  on conflict (endpoint) do update
    set profile_id = excluded.profile_id,
        p256dh     = excluded.p256dh,
        auth       = excluded.auth,
        user_agent = excluded.user_agent;
end;
$$;

create or replace function store.push_unsubscribe(p_endpoint text)
returns void
language sql security definer set search_path = store, public
as $$
  delete from store.push_subscriptions
  where endpoint = p_endpoint and profile_id = auth.uid();
$$;

create or replace function public.push_subscribe(
  p_endpoint text, p_p256dh text, p_auth text, p_ua text default null
) returns void
language sql security definer set search_path = store, public
as $$ select store.push_subscribe(p_endpoint, p_p256dh, p_auth, p_ua); $$;

create or replace function public.push_unsubscribe(p_endpoint text)
returns void
language sql security definer set search_path = store, public
as $$ select store.push_unsubscribe(p_endpoint); $$;

grant execute on function public.push_subscribe(text, text, text, text)   to authenticated;
grant execute on function public.push_unsubscribe(text)                   to authenticated;
grant execute on function store.push_subscribe(text, text, text, text)    to authenticated;
grant execute on function store.push_unsubscribe(text)                    to authenticated;
