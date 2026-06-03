-- Allow login with username in addition to email.
-- Username is optional, unique (case-insensitive), and set by admin.

alter table store.profiles
  add column if not exists username text;

-- Case-insensitive unique index (nulls excluded — multiple null usernames allowed)
create unique index if not exists profiles_username_lower_idx
  on store.profiles (lower(username))
  where username is not null;

-- Resolves a username to the auth email so the client can call signInWithPassword.
-- SECURITY DEFINER so it can join auth.users without exposing that table.
-- Callable by anon (needed at login time, before authentication).
create or replace function store.get_email_by_username(uname text)
  returns text
  language sql
  security definer
  stable
  set search_path to 'store', 'auth', 'public'
as $$
  select u.email::text
  from auth.users u
  join store.profiles p on p.id = u.id
  where lower(p.username) = lower(trim(uname))
  limit 1;
$$;

grant execute on function store.get_email_by_username(text) to anon, authenticated;
