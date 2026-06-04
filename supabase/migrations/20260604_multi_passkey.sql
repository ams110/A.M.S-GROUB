-- Multi-passkey support — a row per registered authenticator (device), so a
-- user can enrol several devices instead of overwriting a single credential.
--
-- NOTE: public.passkey_credentials already exists (a *different* app sharing
-- this Supabase project), so we keep our table in `store` and expose access via
-- RPC wrappers in public — NOT a public view (the name is taken). Same pattern
-- used for push_subscriptions.

create table if not exists store.passkey_credentials (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key    text not null,
  counter       bigint not null default 0,
  device_label  text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index if not exists idx_passkey_credentials_user
  on store.passkey_credentials(user_id);

alter table store.passkey_credentials enable row level security;

-- Reads/deletes are scoped to the owner; inserts/counter-updates happen through
-- the Edge Functions (service_role, which bypasses RLS).
drop policy if exists pk_cred_select_own on store.passkey_credentials;
create policy pk_cred_select_own on store.passkey_credentials
  for select using ((select auth.uid()) = user_id);

drop policy if exists pk_cred_delete_own on store.passkey_credentials;
create policy pk_cred_delete_own on store.passkey_credentials
  for delete using ((select auth.uid()) = user_id);

grant usage on schema store to anon, authenticated;
grant select, delete on store.passkey_credentials to anon, authenticated;
grant all on store.passkey_credentials to service_role;

-- Carry over any credential previously stored on profiles so existing users
-- keep their passkey.
insert into store.passkey_credentials (user_id, credential_id, public_key, counter, device_label)
select id, passkey_credential_id, passkey_public_key, coalesce(passkey_counter, 0), 'מכשיר קיים'
from store.profiles
where passkey_credential_id is not null
on conflict (credential_id) do nothing;

-- ── Client RPCs (public wrappers required for PostgREST) ────────────────────
create or replace function store.list_passkeys()
returns table (id uuid, device_label text, created_at timestamptz, last_used_at timestamptz)
language sql security definer set search_path = store, public stable as $$
  select id, device_label, created_at, last_used_at
  from store.passkey_credentials
  where user_id = auth.uid()
  order by created_at;
$$;

create or replace function store.remove_passkey(p_id uuid)
returns void
language sql security definer set search_path = store, public as $$
  delete from store.passkey_credentials where id = p_id and user_id = auth.uid();
$$;

create or replace function public.list_passkeys()
returns table (id uuid, device_label text, created_at timestamptz, last_used_at timestamptz)
language sql security definer set search_path = store, public stable as $$
  select * from store.list_passkeys();
$$;

create or replace function public.remove_passkey(p_id uuid)
returns void
language sql security definer set search_path = store, public as $$
  select store.remove_passkey(p_id);
$$;

grant execute on function store.list_passkeys()            to anon, authenticated, service_role;
grant execute on function store.remove_passkey(uuid)       to anon, authenticated, service_role;
grant execute on function public.list_passkeys()           to anon, authenticated;
grant execute on function public.remove_passkey(uuid)      to anon, authenticated;
