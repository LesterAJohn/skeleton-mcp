import dotenv from "dotenv";

dotenv.config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function positiveNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Environment variable ${name} must be a non-negative number`);
  }
  return value;
}

export const env = {
  mcpServerName: process.env.MCP_SERVER_NAME ?? "skeleton-mcp",
  mcpServerVersion: process.env.MCP_SERVER_VERSION ?? "0.1.0",
  allowSensitiveOutput: String(process.env.MCP_ALLOW_SENSITIVE_OUTPUT ?? "").toLowerCase() === "true",
  adminAuthKey: process.env.MCP_ADMIN_AUTH_KEY ?? "",
  postgres: {
    host: required("POSTGRES_HOST", "127.0.0.1"),
    port: Number(required("POSTGRES_PORT", "5432")),
    database: required("POSTGRES_DB", "mcp_config"),
    user: required("POSTGRES_USER", "mcp_user"),
    password: required("POSTGRES_PASSWORD", "mcp_password")
  },
  vault: {
    endpoint: required("VAULT_ADDR", "http://127.0.0.1:8200"),
    token: required("VAULT_TOKEN", "root"),
    kvMount: required("VAULT_KV_MOUNT", "secret"),
    writeRetryAttempts: positiveNumber("VAULT_WRITE_RETRY_ATTEMPTS", "3"),
    writeRetryBaseDelayMs: positiveNumber("VAULT_WRITE_RETRY_BASE_DELAY_MS", "200"),
    writeRetryMaxDelayMs: positiveNumber("VAULT_WRITE_RETRY_MAX_DELAY_MS", "2000")
  }
};
