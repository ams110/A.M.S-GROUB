-- Adds super_admin role: a higher privilege level above regular admin.
-- Only super_admin can grant/revoke admin roles (enforced by trigger).
-- is_admin() returns true for both admin and super_admin (backward compatible).

alter table store.profiles drop constraint if exists profiles_role_check;
alter table store.profiles add constraint profiles_role_check
  check (role in ('dealer', 'admin', 'super_admin'));

create or replace function store.is_admin()
  returns boolean language sql stable security definer
  set search_path to 'store','public'
as $$
  select exists (
    select 1 from store.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;

create or replace function store.is_super_admin()
  returns boolean language sql stable security definer
  set search_path to 'store','public'
as $$
  select exists (
    select 1 from store.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function store.guard_role_change()
  returns trigger language plpgsql security definer
  set search_path to 'store','public'
as $$
begin
  if NEW.role <> OLD.role then
    -- auth.uid() is NULL when called by service role — allow migrations/edge functions.
    -- Only block regular authenticated users who are not super_admin.
    if auth.uid() is not null and not exists (
      select 1 from store.profiles
      where id = auth.uid() and role = 'super_admin'
    ) then
      raise exception 'ONLY_SUPER_ADMIN_CAN_CHANGE_ROLE';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_guard_role_change on store.profiles;
create trigger trg_guard_role_change
  before update on store.profiles
  for each row execute function store.guard_role_change();
