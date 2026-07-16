import assert from "node:assert/strict";
import test from "node:test";

import { createMcpServer } from "../src/mcp/server.js";

function setEnv(updates) {
  const previous = {};
  for (const [key, value] of Object.entries(updates)) {
    previous[key] = process.env[key];
    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }

  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

function createServices() {
  const calls = {
    setSecret: 0,
    setConfig: 0,
    tokenLookupSelf: 0,
    getSecretPaths: [],
    setSecretPayloads: []
  };

  const configStore = {
    async healthcheck() {
      return { ok: true };
    },
    async listConfigs() {
      return [{ key: "sample.feature", value: { enabled: true } }];
    },
    async getConfig() {
      return { key: "sample.feature", value: { enabled: true }, updated_at: "2026-01-01T00:00:00.000Z" };
    },
    async setConfig(key, value) {
      calls.setConfig += 1;
      return { key, value, updated_at: "2026-01-01T00:00:00.000Z" };
    },
    async deleteConfig(key) {
      return key === "sample.feature";
    }
  };

  const vaultService = {
    getConnectionInfo() {
      return { VAULT_ADDR: "http://127.0.0.1:8200", VAULT_TOKEN: "set", VAULT_KV_MOUNT: "secret" };
    },
    async healthcheck() {
      return { ok: true };
    },
    async listSecrets() {
      return ["demo"];
    },
    async getSecret() {
      calls.getSecretPaths.push("demo");
      return {
        access_token: "abc123",
        region: "us-east-1"
      };
    },
    async setSecret(path, value) {
      calls.setSecret += 1;
      calls.setSecretPayloads.push({ path, value });
      return { ok: true, path, value };
    },
    async deleteSecret(path) {
      return { ok: true, path };
    },
    async readAgentToken() {
      return { token: "agent-token", tokenFilePath: "/tmp/vault-agent-token" };
    },
    async tokenLookupSelf() {
      calls.tokenLookupSelf += 1;
      return { auth: { renewable: true } };
    },
    async tokenRenewSelf() {
      return { auth: { lease_duration: 3600 } };
    },
    async tokenCreate() {
      return { auth: { client_token: "new-token" } };
    },
    async tokenRevoke() {
      return { revoked: true };
    },
    async tokenRevokeSelf() {
      return { revoked: true };
    }
  };

  return { configStore, vaultService, calls };
}

async function invokeTool(server, name, args = {}) {
  const registeredTools = server._registeredTools;
  assert.ok(registeredTools[name], `Expected tool ${name} to be registered`);
  const result = await registeredTools[name].handler(args);
  const payload = JSON.parse(result.content[0].text);
  return { result, payload };
}

test("healthcheck returns ok when dependencies are reachable", async () => {
  const restoreEnv = setEnv({ MCP_ALLOW_SENSITIVE_OUTPUT: "false", MCP_ADMIN_AUTH_KEY: "" });

  try {
    const { configStore, vaultService } = createServices();
    const server = createMcpServer({
      name: "skeleton-mcp",
      version: "0.1.0",
      configStore,
      vaultService
    });

    const { payload } = await invokeTool(server, "healthcheck");

    assert.equal(payload.ok, true);
    assert.equal(payload.status, 200);
    assert.deepEqual(payload.data, { postgres: "ok", vault: "ok" });
  } finally {
    restoreEnv();
  }
});

test("set_secret enforces admin authorization key when configured", async () => {
  const restoreEnv = setEnv({ MCP_ALLOW_SENSITIVE_OUTPUT: "false", MCP_ADMIN_AUTH_KEY: "super-secret" });

  try {
    const { configStore, vaultService, calls } = createServices();
    const server = createMcpServer({
      name: "skeleton-mcp",
      version: "0.1.0",
      configStore,
      vaultService
    });

    const unauthorized = await invokeTool(server, "set_secret", {
      path: "demo",
      value: { access_token: "abc123" }
    });

    assert.equal(unauthorized.result.isError, true);
    assert.equal(unauthorized.payload.status, 401);
    assert.match(unauthorized.payload.error, /Unauthorized/);
    assert.equal(calls.setSecret, 0);

    const authorized = await invokeTool(server, "set_secret", {
      path: "demo",
      value: { access_token: "abc123" },
      authorizationKey: "super-secret"
    });

    assert.equal(authorized.payload.ok, true);
    assert.equal(authorized.payload.status, 200);
    assert.equal(calls.setSecret, 1);
  } finally {
    restoreEnv();
  }
});

test("set_config enforces admin authorization key when configured", async () => {
  const restoreEnv = setEnv({ MCP_ALLOW_SENSITIVE_OUTPUT: "false", MCP_ADMIN_AUTH_KEY: "super-secret" });

  try {
    const { configStore, vaultService, calls } = createServices();
    const server = createMcpServer({
      name: "skeleton-mcp",
      version: "0.1.0",
      configStore,
      vaultService
    });

    const unauthorized = await invokeTool(server, "set_config", {
      key: "feature.test",
      value: { enabled: true }
    });

    assert.equal(unauthorized.result.isError, true);
    assert.equal(unauthorized.payload.status, 401);
    assert.equal(calls.setConfig, 0);

    const authorized = await invokeTool(server, "set_config", {
      key: "feature.test",
      value: { enabled: true },
      authorizationKey: "super-secret"
    });

    assert.equal(authorized.payload.ok, true);
    assert.equal(authorized.payload.status, 200);
    assert.equal(calls.setConfig, 1);
  } finally {
    restoreEnv();
  }
});

test("token_lookup_self enforces admin authorization key when configured", async () => {
  const restoreEnv = setEnv({ MCP_ALLOW_SENSITIVE_OUTPUT: "false", MCP_ADMIN_AUTH_KEY: "super-secret" });

  try {
    const { configStore, vaultService, calls } = createServices();
    const server = createMcpServer({
      name: "skeleton-mcp",
      version: "0.1.0",
      configStore,
      vaultService
    });

    const unauthorized = await invokeTool(server, "token_lookup_self", {});

    assert.equal(unauthorized.result.isError, true);
    assert.equal(unauthorized.payload.status, 401);
    assert.equal(calls.tokenLookupSelf, 0);

    const authorized = await invokeTool(server, "token_lookup_self", {
      authorizationKey: "super-secret"
    });

    assert.equal(authorized.payload.ok, true);
    assert.equal(authorized.payload.status, 200);
    assert.equal(calls.tokenLookupSelf, 1);
  } finally {
    restoreEnv();
  }
});

test("get_secret redacts sensitive fields unless explicitly enabled", async () => {
  const restoreEnv = setEnv({ MCP_ALLOW_SENSITIVE_OUTPUT: "false", MCP_ADMIN_AUTH_KEY: "" });

  try {
    const { configStore, vaultService } = createServices();
    const server = createMcpServer({
      name: "skeleton-mcp",
      version: "0.1.0",
      configStore,
      vaultService
    });

    const redacted = await invokeTool(server, "get_secret", { path: "demo" });
    assert.equal(redacted.payload.data.access_token, "[REDACTED]");
    assert.equal(redacted.payload.data.region, "us-east-1");
  } finally {
    restoreEnv();
  }

  const restoreEnvSensitive = setEnv({ MCP_ALLOW_SENSITIVE_OUTPUT: "true", MCP_ADMIN_AUTH_KEY: "" });

  try {
    const { configStore, vaultService } = createServices();
    const server = createMcpServer({
      name: "skeleton-mcp",
      version: "0.1.0",
      configStore,
      vaultService
    });

    const full = await invokeTool(server, "get_secret", { path: "demo" });
    assert.equal(full.payload.data.access_token, "abc123");
    assert.equal(full.payload.data.region, "us-east-1");
  } finally {
    restoreEnvSensitive();
  }
});

test("vault_seed_http_token generates and stores an opaque bearer token", async () => {
  const restoreEnv = setEnv({ MCP_ALLOW_SENSITIVE_OUTPUT: "false", MCP_ADMIN_AUTH_KEY: "super-secret", APP_NAME: "skeleton" });

  try {
    const { configStore, vaultService, calls } = createServices();
    let firstPayload = null;
    vaultService.getSecret = async () => {
      if (!firstPayload) {
        const error = new Error("404 not found");
        error.statusCode = 404;
        throw error;
      }
      return firstPayload;
    };
    vaultService.setSecret = async (path, value) => {
      calls.setSecret += 1;
      calls.setSecretPayloads.push({ path, value });
      firstPayload = value;
      return { ok: true, path };
    };

    const server = createMcpServer({
      name: "skeleton-mcp",
      version: "0.1.0",
      configStore,
      vaultService
    });

    const unauthorized = await invokeTool(server, "vault_seed_http_token", {
      userId: "user-123"
    });

    assert.equal(unauthorized.result.isError, true);
    assert.equal(unauthorized.payload.status, 401);

    const authorized = await invokeTool(server, "vault_seed_http_token", {
      userId: "user-123",
      tokenId: "tok-123",
      scopes: ["mcp:invoke", "mcp:read"],
      audience: "codex",
      authorizationKey: "super-secret"
    });

    assert.equal(authorized.payload.ok, true);
    assert.equal(authorized.payload.status, 200);
    assert.equal(typeof authorized.payload.data.token, "string");
    assert.equal(authorized.payload.data.userId, "user-123");
    assert.equal(authorized.payload.data.tokenId, "[REDACTED]");
    assert.deepEqual(authorized.payload.data.scopes, ["mcp:invoke", "mcp:read"]);
    assert.deepEqual(authorized.payload.data.audience, ["codex"]);
    assert.equal(calls.setSecret, 1);
    assert.equal(calls.setSecretPayloads[0].path, "skeleton/http/auth/token-index");
    assert.equal(Boolean(calls.setSecretPayloads[0].value.tokens), true);
    assert.equal(Boolean(calls.setSecretPayloads[0].value.users["user-123"].tokens), true);
    const persistedTokenHash = Object.keys(calls.setSecretPayloads[0].value.users["user-123"].tokens)[0];
    assert.equal(calls.setSecretPayloads[0].value.tokens[persistedTokenHash].tokenId, "tok-123");
    assert.equal(calls.setSecretPayloads[0].value.users["user-123"].tokens[persistedTokenHash].tokenId, "tok-123");
  } finally {
    restoreEnv();
  }
});

test("vault_seed_oauth_token stores a provided OAuth token in the Vault user structure", async () => {
  const restoreEnv = setEnv({ MCP_ALLOW_SENSITIVE_OUTPUT: "false", MCP_ADMIN_AUTH_KEY: "super-secret", APP_NAME: "skeleton" });

  try {
    const { configStore, vaultService, calls } = createServices();
    let firstPayload = null;
    vaultService.getSecret = async () => {
      if (!firstPayload) {
        const error = new Error("404 not found");
        error.statusCode = 404;
        throw error;
      }
      return firstPayload;
    };
    vaultService.setSecret = async (path, value) => {
      calls.setSecret += 1;
      calls.setSecretPayloads.push({ path, value });
      firstPayload = value;
      return { ok: true, path };
    };

    const server = createMcpServer({
      name: "skeleton-mcp",
      version: "0.1.0",
      configStore,
      vaultService
    });

    const unauthorized = await invokeTool(server, "vault_seed_oauth_token", {
      userId: "user-123",
      token: "oauth-access-token"
    });

    assert.equal(unauthorized.result.isError, true);
    assert.equal(unauthorized.payload.status, 401);

    const authorized = await invokeTool(server, "vault_seed_oauth_token", {
      userId: "user-123",
      token: "oauth-access-token",
      tokenId: "tok-oauth-123",
      scopes: ["openid", "profile"],
      audience: "my-app",
      authorizationKey: "super-secret"
    });

    assert.equal(authorized.payload.ok, true);
    assert.equal(authorized.payload.status, 200);
  assert.equal(authorized.payload.data.tokenId, "[REDACTED]");
    assert.deepEqual(authorized.payload.data.scopes, ["openid", "profile"]);
    assert.deepEqual(authorized.payload.data.audience, ["my-app"]);
    assert.equal(calls.setSecret, 1);
    assert.equal(calls.setSecretPayloads[0].path, "skeleton/http/auth/token-index");
    assert.equal(Boolean(calls.setSecretPayloads[0].value.tokens), true);
    assert.equal(Boolean(calls.setSecretPayloads[0].value.users["user-123"].tokens), true);
    const persistedTokenHash = Object.keys(calls.setSecretPayloads[0].value.users["user-123"].tokens)[0];
    assert.equal(calls.setSecretPayloads[0].value.tokens[persistedTokenHash].tokenType, "oauth2");
    assert.equal(calls.setSecretPayloads[0].value.users["user-123"].tokens[persistedTokenHash].tokenId, "tok-oauth-123");
  } finally {
    restoreEnv();
  }
});
