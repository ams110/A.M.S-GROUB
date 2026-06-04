-- Layer B — performance: optimize `store` RLS policies.
--
-- 1) Wrap `auth.uid()` and the STABLE `store.is_admin()` in scalar sub-selects
--    `(select …)` so Postgres evaluates them once per statement (InitPlan)
--    instead of once per row. Behaviour is identical; only speed improves.
-- 2) Collapse the two permissive SELECT policies on `store.products`
--    (admin-read + public-read) into one, removing a redundant policy.

-- ── banners ────────────────────────────────────────────────────────────────
alter policy ban_admin_write on store.banners
  using ((select store.is_admin())) with check ((select store.is_admin()));

-- ── categories ─────────────────────────────────────────────────────────────
alter policy cat_admin_write on store.categories
  using ((select store.is_admin())) with check ((select store.is_admin()));

-- ── customer_prices ────────────────────────────────────────────────────────
alter policy cp_admin_all on store.customer_prices
  using ((select store.is_admin())) with check ((select store.is_admin()));
alter policy cp_read_own on store.customer_prices
  using ((profile_id = (select auth.uid())));

-- ── invoices ───────────────────────────────────────────────────────────────
alter policy inv_admin_all on store.invoices
  using ((select store.is_admin())) with check ((select store.is_admin()));
alter policy inv_read_own on store.invoices
  using ((customer_id = (select auth.uid())));

-- ── order_items ────────────────────────────────────────────────────────────
alter policy oit_select_own on store.order_items
  using (
    (select store.is_admin())
    or (exists (
      select 1 from store.orders o
      where o.id = order_items.order_id and o.dealer_id = (select auth.uid())
    ))
  );

-- ── orders ─────────────────────────────────────────────────────────────────
alter policy ord_select_own on store.orders
  using ((dealer_id = (select auth.uid())) or (select store.is_admin()));
alter policy ord_admin_update on store.orders
  using ((select store.is_admin())) with check ((select store.is_admin()));

-- ── products (wrap + consolidate the two SELECT policies into one) ──────────
drop policy if exists prod_admin_read on store.products;
alter policy prod_public_read on store.products
  using ((deleted_at is null) or (select store.is_admin()));
alter policy prod_admin_write on store.products
  using ((select store.is_admin())) with check ((select store.is_admin()));

-- ── profiles ───────────────────────────────────────────────────────────────
alter policy prof_admin_all on store.profiles
  using ((select store.is_admin())) with check ((select store.is_admin()));
alter policy prof_select_own on store.profiles
  using ((id = (select auth.uid())) or (select store.is_admin()));
alter policy prof_update_own on store.profiles
  using ((id = (select auth.uid())) or (select store.is_admin()))
  with check (
    (select store.is_admin())
    or (
      id = (select auth.uid())
      and role   = (select p1.role   from store.profiles p1 where p1.id = (select auth.uid()))
      and status = (select p1.status from store.profiles p1 where p1.id = (select auth.uid()))
    )
  );

-- ── purchase_orders / purchase_order_items ─────────────────────────────────
alter policy purchase_orders_admin_all on store.purchase_orders
  using ((select store.is_admin())) with check ((select store.is_admin()));
alter policy purchase_order_items_admin_all on store.purchase_order_items
  using ((select store.is_admin())) with check ((select store.is_admin()));

-- ── quotes / quote_items ───────────────────────────────────────────────────
alter policy q_admin_all on store.quotes
  using ((select store.is_admin())) with check ((select store.is_admin()));
alter policy q_read_own on store.quotes
  using ((customer_id = (select auth.uid())));
alter policy qi_admin_all on store.quote_items
  using ((select store.is_admin())) with check ((select store.is_admin()));
alter policy qi_read_own on store.quote_items
  using (exists (
    select 1 from store.quotes q
    where q.id = quote_items.quote_id and q.customer_id = (select auth.uid())
  ));

-- ── settings ───────────────────────────────────────────────────────────────
alter policy set_admin_write on store.settings
  using ((select store.is_admin())) with check ((select store.is_admin()));

-- ── stock_movements / suppliers / warehouses ───────────────────────────────
alter policy stock_movements_admin_all on store.stock_movements
  using ((select store.is_admin())) with check ((select store.is_admin()));
alter policy suppliers_admin_all on store.suppliers
  using ((select store.is_admin())) with check ((select store.is_admin()));
alter policy warehouses_admin_all on store.warehouses
  using ((select store.is_admin())) with check ((select store.is_admin()));
