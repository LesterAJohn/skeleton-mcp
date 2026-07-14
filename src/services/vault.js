import vault from "node-vault";

export class VaultService {
  constructor({
    endpoint,
    token,
    kvMount,
    writeRetryAttempts = 3,
    writeRetryBaseDelayMs = 200,
    writeRetryMaxDelayMs = 2000
  }) {
    this.client = vault({ endpoint, token, apiVersion: "v1" });
    this.endpoint = endpoint;
    this.tokenConfigured = Boolean(token);
    this.kvMount = kvMount;
    this.writeRetryAttempts = writeRetryAttempts;
    this.writeRetryBaseDelayMs = writeRetryBaseDelayMs;
    this.writeRetryMaxDelayMs = writeRetryMaxDelayMs;
    this.writeQueue = Promise.resolve();
  }

  getConnectionInfo() {
    return {
      VAULT_ADDR: this.endpoint,
      VAULT_TOKEN: this.tokenConfigured ? "set" : null,
      VAULT_KV_MOUNT: this.kvMount,
      VAULT_WRITE_RETRY_ATTEMPTS: this.writeRetryAttempts,
      VAULT_WRITE_RETRY_BASE_DELAY_MS: this.writeRetryBaseDelayMs,
      VAULT_WRITE_RETRY_MAX_DELAY_MS: this.writeRetryMaxDelayMs
    };
  }

  async healthcheck() {
    await this.client.health();
    return { ok: true };
  }

  async listSecrets(prefix) {
    const normalizedPrefix = String(prefix ?? "").replace(/^\/+|\/+$/g, "");
    const path = normalizedPrefix ? `${this.kvMount}/metadata/${normalizedPrefix}` : `${this.kvMount}/metadata`;
    const response = await this.client.list(path);
    return response?.data?.keys ?? [];
  }

  async getSecret(path) {
    const response = await this.client.read(`${this.kvMount}/data/${path}`);
    return response?.data?.data ?? null;
  }

  async setSecret(path, value) {
    await this.enqueueWrite(() => this.client.write(`${this.kvMount}/data/${path}`, { data: value }));
    return { ok: true, path };
  }

  async deleteSecret(path) {
    await this.enqueueWrite(() => this.client.delete(`${this.kvMount}/data/${path}`));
    return { ok: true, path };
  }

  enqueueWrite(operation) {
    const job = this.writeQueue.then(() => this.withWriteRetry(operation));
    this.writeQueue = job.catch(() => undefined);
    return job;
  }

  async withWriteRetry(operation) {
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        if (attempt >= this.writeRetryAttempts) {
          throw error;
        }

        const delay = Math.min(this.writeRetryBaseDelayMs * Math.pow(2, attempt), this.writeRetryMaxDelayMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt += 1;
      }
    }
  }
}
