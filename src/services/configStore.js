import pg from "pg";

const { Pool } = pg;

export class ConfigStore {
  constructor(postgresConfig) {
    this.pool = new Pool(postgresConfig);
  }

  async healthcheck() {
    await this.pool.query("SELECT 1");
    return { ok: true };
  }

  async listConfigs(prefix) {
    const hasPrefix = Boolean(prefix && prefix.trim());
    const result = hasPrefix
      ? await this.pool.query(
          "SELECT key, value, updated_at FROM app_config WHERE key ILIKE $1 ORDER BY key ASC",
          [`${prefix}%`]
        )
      : await this.pool.query("SELECT key, value, updated_at FROM app_config ORDER BY key ASC");

    return result.rows;
  }

  async getConfig(key) {
    const result = await this.pool.query(
      "SELECT key, value, updated_at FROM app_config WHERE key = $1",
      [key]
    );

    return result.rows[0] ?? null;
  }

  async setConfig(key, value) {
    const result = await this.pool.query(
      `
      INSERT INTO app_config (key, value, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      RETURNING key, value, updated_at
      `,
      [key, JSON.stringify(value)]
    );

    return result.rows[0];
  }

  async deleteConfig(key) {
    const result = await this.pool.query("DELETE FROM app_config WHERE key = $1", [key]);
    return result.rowCount > 0;
  }

  async close() {
    await this.pool.end();
  }
}
