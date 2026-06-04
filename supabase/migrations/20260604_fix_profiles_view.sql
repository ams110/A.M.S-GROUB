-- Keep the public.profiles view (proxy for store.profiles) in sync with the
-- columns the client needs:
--   • username             — added by 20260603_username_login.sql
--   • passkey_credential_id — added by 20260603_passkeys.sql (read on /account/security)
-- security_invoker = on so the view enforces store.profiles RLS (see
-- 20260604_store_security_invoker_views.sql).

CREATE OR REPLACE VIEW public.profiles WITH (security_invoker = on) AS
  SELECT id, role, status, full_name, phone, company, city, address,
         created_at, updated_at, customer_type, credit_limit, payment_terms,
         username, passkey_credential_id
  FROM store.profiles;
