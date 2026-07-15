CREATE TABLE IF NOT EXISTS app_config (
  user_id TEXT NOT NULL DEFAULT 'default',
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, key)
);

ALTER TABLE app_config
  ADD COLUMN IF NOT EXISTS user_id TEXT;

UPDATE app_config
SET user_id = 'default'
WHERE user_id IS NULL OR trim(user_id) = '';

ALTER TABLE app_config
  ALTER COLUMN user_id SET DEFAULT 'default';

ALTER TABLE app_config
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_config_pkey'
      AND conrelid = 'app_config'::regclass
  ) THEN
    ALTER TABLE app_config DROP CONSTRAINT app_config_pkey;
  END IF;

  ALTER TABLE app_config ADD CONSTRAINT app_config_pkey PRIMARY KEY (user_id, key);
END
$$;

CREATE INDEX IF NOT EXISTS app_config_key_idx ON app_config (key);

INSERT INTO app_config (user_id, key, value)
VALUES
  ('default', 'sample.feature', '{"enabled": true, "rollout": 25}'),
  ('default', 'app.defaults', '{"version": 1, "parameters": {}}'),
  ('default', 'token.rotation.intervalMs', '86400000')
ON CONFLICT (user_id, key) DO NOTHING;
