-- Profile avatar: add avatar_url to store.profiles and expose it via the
-- public.profiles view (kept in sync with 20260604_fix_profiles_view.sql).
-- Self-update is already allowed by the prof_update_own RLS policy (0001).

alter table store.profiles add column if not exists avatar_url text;

create or replace view public.profiles with (security_invoker = on) as
  select id, role, status, full_name, phone, company, city, address,
         created_at, updated_at, customer_type, credit_limit, payment_terms,
         username, passkey_credential_id, avatar_url
  from store.profiles;
