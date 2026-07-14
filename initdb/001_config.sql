CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_config (key, value)
VALUES ('sample.feature', '{"enabled": true, "rollout": 25}')
ON CONFLICT (key) DO NOTHING;
