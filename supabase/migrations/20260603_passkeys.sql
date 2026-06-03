-- Passkey (WebAuthn) support for the store

-- 1. Add passkey columns to store.profiles
ALTER TABLE store.profiles
  ADD COLUMN IF NOT EXISTS passkey_credential_id TEXT   UNIQUE,
  ADD COLUMN IF NOT EXISTS passkey_public_key    TEXT,
  ADD COLUMN IF NOT EXISTS passkey_counter       BIGINT NOT NULL DEFAULT 0;

-- 2. One-time challenge table — entries are deleted after use or on expiry
CREATE TABLE IF NOT EXISTS store.passkey_challenges (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge  TEXT        NOT NULL UNIQUE,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Accessible only via service-role (Edge Functions) — no user-level policies
ALTER TABLE store.passkey_challenges ENABLE ROW LEVEL SECURITY;
