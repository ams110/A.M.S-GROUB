-- Layer A — performance: index foreign keys in the `store` schema.
-- Unindexed FKs slow down joins, cascade checks, and RLS sub-queries
-- (e.g. order_items→orders, quote_items→quotes which are used by RLS policies).
-- Purely additive and safe; `if not exists` keeps it idempotent.

create index if not exists idx_customer_prices_product_id      on store.customer_prices (product_id);
create index if not exists idx_order_items_order_id            on store.order_items (order_id);
create index if not exists idx_order_items_product_id          on store.order_items (product_id);
create index if not exists idx_orders_dealer_id               on store.orders (dealer_id);
create index if not exists idx_products_category_id            on store.products (category_id);
create index if not exists idx_purchase_order_items_po_id      on store.purchase_order_items (po_id);
create index if not exists idx_purchase_order_items_product_id on store.purchase_order_items (product_id);
create index if not exists idx_purchase_orders_supplier_id     on store.purchase_orders (supplier_id);
create index if not exists idx_quote_items_product_id          on store.quote_items (product_id);
create index if not exists idx_quote_items_quote_id            on store.quote_items (quote_id);
create index if not exists idx_quotes_customer_id              on store.quotes (customer_id);
create index if not exists idx_quotes_order_id                 on store.quotes (order_id);
create index if not exists idx_stock_movements_warehouse_id    on store.stock_movements (warehouse_id);
