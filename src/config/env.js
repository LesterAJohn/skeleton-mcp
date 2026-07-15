import dotenv from "dotenv";

dotenv.config();

const TRANSPORT_MODES = new Set(["stdio", "http", "both"]);
const HTTP_AUTH_MODES = new Set(["token", "oauth2", "both"]);
const HTTP_TOKEN_SOURCES = new Set(["env", "vault"]);

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

function enumValue(name, fallback, allowedValues) {
  const value = String(process.env[name] ?? fallback).toLowerCase();
  if (!allowedValues.has(value)) {
    throw new Error(
      `Environment variable ${name} must be one of: ${Array.from(allowedValues).join(", ")}`
    );
  }
  return value;
}

function booleanValue(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = String(raw).toLowerCase();
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  throw new Error(`Environment variable ${name} must be either true or false`);
}

function parseCsv(name, fallback = "") {
  return String(process.env[name] ?? fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function portNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`Environment variable ${name} must be an integer between 1 and 65535`);
  }
  return value;
}

const transportMode = enumValue("MCP_TRANSPORT_MODE", "stdio", TRANSPORT_MODES);
const httpAuthMode = enumValue("MCP_HTTP_AUTH_MODE", "token", HTTP_AUTH_MODES);
const httpTokenSource = enumValue("MCP_HTTP_TOKEN_SOURCE", "env", HTTP_TOKEN_SOURCES);
const oauth2IntrospectionUrl = process.env.MCP_HTTP_OAUTH2_INTROSPECTION_URL ?? "";

if ((httpAuthMode === "oauth2" || httpAuthMode === "both") && !oauth2IntrospectionUrl) {
  throw new Error(
    "MCP_HTTP_OAUTH2_INTROSPECTION_URL is required when MCP_HTTP_AUTH_MODE is oauth2 or both"
  );
}

export const env = {
  mcpServerName: process.env.MCP_SERVER_NAME ?? "skeleton-mcp",
  mcpServerVersion: process.env.MCP_SERVER_VERSION ?? "0.1.0",
  allowSensitiveOutput: String(process.env.MCP_ALLOW_SENSITIVE_OUTPUT ?? "").toLowerCase() === "true",
  adminAuthKey: process.env.MCP_ADMIN_AUTH_KEY ?? "",
  config: {
    defaultUserId: required("MCP_CONFIG_DEFAULT_USER_ID", "default")
  },
  transport: {
    mode: transportMode,
    http: {
      host: required("MCP_HTTP_HOST", "127.0.0.1"),
      port: portNumber("MCP_HTTP_PORT", "3000"),
      mcpPath: required("MCP_HTTP_PATH", "/mcp"),
      healthPath: required("MCP_HTTP_HEALTH_PATH", "/healthz"),
      authMode: httpAuthMode,
      tokenSource: httpTokenSource,
      authTokens: parseCsv("MCP_HTTP_AUTH_TOKENS", ""),
      trustedProxy: booleanValue("MCP_HTTP_TRUST_PROXY", false),
      allowedOrigins: parseCsv("MCP_HTTP_ALLOWED_ORIGINS", ""),
      allowedIps: parseCsv("MCP_HTTP_ALLOWED_IPS", ""),
      maxBodyBytes: positiveNumber("MCP_HTTP_MAX_BODY_BYTES", "1048576"),
      rateLimitWindowMs: positiveNumber("MCP_HTTP_RATE_LIMIT_WINDOW_MS", "60000"),
      rateLimitMaxRequests: positiveNumber("MCP_HTTP_RATE_LIMIT_MAX_REQUESTS", "60"),
      oauth2: {
        introspectionUrl: oauth2IntrospectionUrl,
        clientId: process.env.MCP_HTTP_OAUTH2_CLIENT_ID ?? "",
        clientSecret: process.env.MCP_HTTP_OAUTH2_CLIENT_SECRET ?? "",
        requiredScopes: parseCsv("MCP_HTTP_OAUTH2_REQUIRED_SCOPES", ""),
        requiredAudience: process.env.MCP_HTTP_OAUTH2_REQUIRED_AUDIENCE ?? "",
        timeoutMs: positiveNumber("MCP_HTTP_OAUTH2_TIMEOUT_MS", "5000"),
        cacheTtlMs: positiveNumber("MCP_HTTP_OAUTH2_CACHE_TTL_MS", "30000")
      },
      vaultToken: {
        indexPath: required("MCP_HTTP_VAULT_TOKEN_INDEX_PATH", "mcp/http/auth/token-index"),
        defaultUserId: required("MCP_HTTP_VAULT_TOKEN_DEFAULT_USER_ID", "default"),
        requiredScopes: parseCsv("MCP_HTTP_VAULT_TOKEN_REQUIRED_SCOPES", ""),
        requiredAudience: process.env.MCP_HTTP_VAULT_TOKEN_REQUIRED_AUDIENCE ?? "",
        cacheTtlMs: positiveNumber("MCP_HTTP_VAULT_TOKEN_CACHE_TTL_MS", "30000")
      },
      tls: {
        enabled: booleanValue("MCP_HTTP_TLS_ENABLED", false),
        certPath: process.env.MCP_HTTP_TLS_CERT_PATH ?? "",
        keyPath: process.env.MCP_HTTP_TLS_KEY_PATH ?? ""
      }
    }
  },
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
