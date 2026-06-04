-- Bug found while deploying passkeys: the `service_role` (used by Edge Functions
-- such as passkey-auth / passkey-register) had NO access to the `store` schema.
-- The schema only granted privileges to anon/authenticated, so every service_role
-- query hit "permission denied for schema store".
-- Grant the privileged backend role full access (it bypasses RLS by design).

grant usage on schema store to service_role;
grant all on all tables    in schema store to service_role;
grant all on all sequences  in schema store to service_role;
grant all on all routines   in schema store to service_role;

-- Cover objects created in the future too.
alter default privileges in schema store grant all on tables    to service_role;
alter default privileges in schema store grant all on sequences to service_role;
alter default privileges in schema store grant all on routines  to service_role;
