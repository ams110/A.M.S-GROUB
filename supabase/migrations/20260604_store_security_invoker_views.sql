-- Layer C — security: make the public API views respect Row Level Security.
--
-- The app reads `store.*` tables through thin `public.*` views (PostgREST only
-- exposes the `public` schema). Those views were created with the default
-- SECURITY DEFINER semantics, so reads ran as the view owner and BYPASSED the
-- RLS policies on the underlying `store` tables — every signed-in user (and
-- anon) could read ALL rows, including other dealers' profiles/orders and the
-- admin-only suppliers / purchase_orders / stock_movements.
--
-- Setting `security_invoker = on` makes the views run as the calling user, so
-- the existing `store` RLS policies are enforced. Verified safe: anon/authenticated
-- already hold full table privileges and RLS is the real access-control layer.
-- Public-read tables (products, categories, banners, settings) stay readable;
-- owner-scoped tables (profiles, orders, quotes, …) become correctly isolated.

alter view public.banners              set (security_invoker = on);
alter view public.categories           set (security_invoker = on);
alter view public.customer_prices      set (security_invoker = on);
alter view public.order_items          set (security_invoker = on);
alter view public.orders               set (security_invoker = on);
alter view public.products             set (security_invoker = on);
alter view public.profiles             set (security_invoker = on);
alter view public.purchase_order_items set (security_invoker = on);
alter view public.purchase_orders      set (security_invoker = on);
alter view public.quote_items          set (security_invoker = on);
alter view public.quotes               set (security_invoker = on);
alter view public.settings             set (security_invoker = on);
alter view public.stock_movements      set (security_invoker = on);
alter view public.suppliers            set (security_invoker = on);
