-- Server-only secrets table, read by Edge Functions via service_role.
-- RLS on with NO policies + no grants => anon/authenticated cannot read it.
--
-- ⚠️ SECRETS ARE SEEDED OUT-OF-BAND (not committed). After applying this file,
-- set the real values once via a privileged SQL session / MCP:
--
--   insert into store.app_config (key, value) values
--     ('vapid_private_key', '<VAPID private key>'),
--     ('push_hook_secret',  encode(gen_random_bytes(24), 'hex'))
--   on conflict (key) do update set value = excluded.value;
--
-- The VAPID *public* key below is public by design (it also ships in the client
-- via NEXT_PUBLIC_VAPID_PUBLIC_KEY) and must match the private key.

create table if not exists store.app_config (
  key   text primary key,
  value text not null
);

alter table store.app_config enable row level security;
revoke all on store.app_config from anon, authenticated;

insert into store.app_config (key, value) values
  ('vapid_public_key', 'BA1zvmWPc124tSPR4J6fTMEH4LL7xC2ajSarB4DfBSTnvL4OuG3S2ZOYbiMBCsvVKVUq485ZV3Hdr0eWjMW5QYA'),
  ('vapid_subject',    'mailto:a.m.shaqra20100@gmail.com')
on conflict (key) do update set value = excluded.value;
