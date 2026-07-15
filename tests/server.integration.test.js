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
    tokenLookupSelf: 0
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
      return {
        access_token: "abc123",
        region: "us-east-1"
      };
    },
    async setSecret(path, value) {
      calls.setSecret += 1;
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
