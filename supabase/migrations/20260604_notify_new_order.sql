-- Notify admins via Web Push when a new order is placed.
-- Uses pg_net to fire-and-forget a POST to the push-send Edge Function. This is
-- async and never blocks/aborts the order transaction even if push fails.

create or replace function store.notify_admins_new_order()
returns trigger
language plpgsql
security definer
set search_path = store, public
as $$
declare
  hook_secret text;
  dealer_name text;
  anon_key text :=
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2aGpyemJodWd2eXR2a3RkaG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjU1OTMsImV4cCI6MjA5MTg0MTU5M30.LxAACOi1papCp197qsQIdWkm9hIJNY0o-Hc9YiMHPWE';
begin
  select value into hook_secret from store.app_config where key = 'push_hook_secret';
  if hook_secret is null then
    return new;
  end if;

  select coalesce(company, full_name, 'לקוח') into dealer_name
  from store.profiles where id = new.dealer_id;

  perform net.http_post(
    url := 'https://rvhjrzbhugvytvktdhor.supabase.co/functions/v1/push-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon_key,
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object(
      'secret', hook_secret,
      'title', 'הזמנה חדשה 🧾',
      'body', coalesce(dealer_name, 'לקוח') || ' · ' || new.order_number ||
              ' · ' || to_char(new.total, 'FM999,999,990') || '₪',
      'url', '/admin/orders',
      'target', 'admins'
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_order on store.orders;
create trigger trg_notify_new_order
  after insert on store.orders
  for each row execute function store.notify_admins_new_order();
