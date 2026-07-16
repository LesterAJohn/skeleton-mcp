CREATE TABLE IF NOT EXISTS skeleton_config (
  user_id TEXT NOT NULL DEFAULT 'default',
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, key)
);

ALTER TABLE skeleton_config
  ADD COLUMN IF NOT EXISTS user_id TEXT;

UPDATE skeleton_config
SET user_id = 'default'
WHERE user_id IS NULL OR trim(user_id) = '';

ALTER TABLE skeleton_config
  ALTER COLUMN user_id SET DEFAULT 'default';

ALTER TABLE skeleton_config
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS skeleton_config_key_idx ON skeleton_config (key);

INSERT INTO skeleton_config (user_id, key, value)
VALUES
  ('default', 'sample.feature', '{"enabled": true, "rollout": 25}'),
  ('default', 'app.defaults', '{"version": 1, "parameters": {}}'),
  ('default', 'token.rotation.intervalMs', '86400000'),
  ('default', 'vault.agent.auth.mode', '"file"'),
  ('default', 'vault.agent.tokenFilePath', '"/tmp/vault-agent-token"'),
  ('default', 'vault.agent.listener.addr', '"http://127.0.0.1:8100"')
ON CONFLICT (user_id, key) DO NOTHING;
