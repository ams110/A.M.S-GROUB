-- Add missing username column to public.profiles view (proxy for store.profiles).
-- The 20260603_username_login.sql migration added username to store.profiles
-- but the public view was not updated.

CREATE OR REPLACE VIEW public.profiles AS
  SELECT id, role, status, full_name, phone, company, city, address,
         created_at, updated_at, customer_type, credit_limit, payment_terms, username
  FROM store.profiles;
