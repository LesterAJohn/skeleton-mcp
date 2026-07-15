import pg from "pg";

const { Pool } = pg;

export class ConfigStore {
  constructor(postgresConfig, options = {}) {
    this.pool = new Pool(postgresConfig);
    this.defaultUserId = String(options.defaultUserId ?? "default").trim() || "default";
  }

  normalizeUserId(userId) {
    return String(userId ?? this.defaultUserId).trim() || this.defaultUserId;
  }

  async healthcheck() {
    await this.pool.query("SELECT 1");
    return { ok: true };
  }

  async listConfigs(prefix, userId) {
    const effectiveUserId = this.normalizeUserId(userId);
    const hasPrefix = Boolean(prefix && prefix.trim());
    const result = hasPrefix
      ? await this.pool.query(
          "SELECT user_id, key, value, updated_at FROM app_config WHERE user_id = $1 AND key ILIKE $2 ORDER BY key ASC",
          [effectiveUserId, `${prefix}%`]
        )
      : await this.pool.query(
          "SELECT user_id, key, value, updated_at FROM app_config WHERE user_id = $1 ORDER BY key ASC",
          [effectiveUserId]
        );

    return result.rows;
  }

  async getConfig(key, userId) {
    const effectiveUserId = this.normalizeUserId(userId);
    const result = await this.pool.query(
      "SELECT user_id, key, value, updated_at FROM app_config WHERE user_id = $1 AND key = $2",
      [effectiveUserId, key]
    );

    return result.rows[0] ?? null;
  }

  async setConfig(key, value, userId) {
    const effectiveUserId = this.normalizeUserId(userId);
    const result = await this.pool.query(
      `
      INSERT INTO app_config (user_id, key, value, updated_at)
      VALUES ($1, $2, $3::jsonb, NOW())
      ON CONFLICT (user_id, key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      RETURNING user_id, key, value, updated_at
      `,
      [effectiveUserId, key, JSON.stringify(value)]
    );

    return result.rows[0];
  }

  async deleteConfig(key, userId) {
    const effectiveUserId = this.normalizeUserId(userId);
    const result = await this.pool.query("DELETE FROM app_config WHERE user_id = $1 AND key = $2", [
      effectiveUserId,
      key
    ]);
    return result.rowCount > 0;
  }

  async close() {
    await this.pool.end();
  }
}
