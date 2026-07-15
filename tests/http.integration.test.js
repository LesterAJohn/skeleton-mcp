import assert from "node:assert/strict";
import test from "node:test";

import { createHttpMcpServer } from "../src/http/server.js";
import { createMcpServer } from "../src/mcp/server.js";

function createServices() {
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
      return { key, value, updated_at: "2026-01-01T00:00:00.000Z" };
    },
    async deleteConfig() {
      return true;
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
    async setSecret(path) {
      return { ok: true, path };
    },
    async deleteSecret(path) {
      return { ok: true, path };
    }
  };

  return { configStore, vaultService };
}

function createTestServer() {
  const { configStore, vaultService } = createServices();
  const server = createHttpMcpServer({
    host: "127.0.0.1",
    port: 0,
    mcpPath: "/mcp",
    healthPath: "/healthz",
    authTokens: ["test-token"],
    trustedProxy: false,
    allowedOrigins: [],
    allowedIps: [],
    maxBodyBytes: 1024 * 1024,
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 60,
    createMcpServer: () =>
      createMcpServer({
        name: "skeleton-mcp",
        version: "0.1.0",
        configStore,
        vaultService
      })
  });

  return server;
}

function createOauthTestServer(verifierResult) {
  const { configStore, vaultService } = createServices();

  return createHttpMcpServer({
    host: "127.0.0.1",
    port: 0,
    mcpPath: "/mcp",
    healthPath: "/healthz",
    authMode: "oauth2",
    authTokens: [],
    oauth2Verifier: {
      async verify() {
        return verifierResult;
      }
    },
    trustedProxy: false,
    allowedOrigins: [],
    allowedIps: [],
    maxBodyBytes: 1024 * 1024,
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 60,
    createMcpServer: () =>
      createMcpServer({
        name: "skeleton-mcp",
        version: "0.1.0",
        configStore,
        vaultService
      })
  });
}

function initializeRequestPayload() {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    }
  };
}

function parseSseMessages(bodyText) {
  return bodyText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean)
    .map((jsonText) => JSON.parse(jsonText));
}

test("unauthorized HTTP request is rejected", async () => {
  const server = createTestServer();
  await server.start();

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(initializeRequestPayload())
    });

    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.jsonrpc, "2.0");
    assert.equal(payload.error.message, "Unauthorized");
  } finally {
    await server.close();
  }
});

test("authorized HTTP MCP initialize call succeeds", async () => {
  const server = createTestServer();
  await server.start();

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: "Bearer test-token"
      },
      body: JSON.stringify(initializeRequestPayload())
    });

    assert.equal(response.status, 200);

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      assert.equal(payload.jsonrpc, "2.0");
      assert.equal(payload.id, 1);
      assert.equal(payload.result.serverInfo.name, "skeleton-mcp");
      return;
    }

    assert.ok(contentType.includes("text/event-stream"));
    const bodyText = await response.text();
    const messages = parseSseMessages(bodyText);
    const initializeResult = messages.find((message) => message.id === 1);

    assert.ok(initializeResult);
    assert.equal(initializeResult.jsonrpc, "2.0");
    assert.equal(initializeResult.result.serverInfo.name, "skeleton-mcp");
  } finally {
    await server.close();
  }
});

test("HTTP MCP internal failures keep JSON-RPC error shape", async () => {
  const server = createHttpMcpServer({
    host: "127.0.0.1",
    port: 0,
    mcpPath: "/mcp",
    healthPath: "/healthz",
    authTokens: ["test-token"],
    trustedProxy: false,
    allowedOrigins: [],
    allowedIps: [],
    maxBodyBytes: 1024 * 1024,
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 60,
    createMcpServer: () => {
      throw new Error("boom");
    }
  });

  await server.start();

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-token"
      },
      body: JSON.stringify(initializeRequestPayload())
    });

    assert.equal(response.status, 500);

    const payload = await response.json();
    assert.equal(payload.jsonrpc, "2.0");
    assert.equal(payload.error.code, -32603);
    assert.equal(payload.error.message, "Internal server error");
    assert.equal(payload.id, null);
  } finally {
    await server.close();
  }
});

test("health endpoint reports HTTP MCP status", async () => {
  const server = createTestServer();
  await server.start();

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.status, 200);
    assert.equal(payload.transport, "http");
    assert.equal(payload.path, "/mcp");
  } finally {
    await server.close();
  }
});

test("OAuth2 mode rejects unauthorized tokens", async () => {
  const server = createOauthTestServer({ ok: false, reason: "inactive_token" });
  await server.start();

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer oauth-test-token"
      },
      body: JSON.stringify(initializeRequestPayload())
    });

    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.jsonrpc, "2.0");
    assert.equal(payload.error.message, "Unauthorized");
  } finally {
    await server.close();
  }
});

test("OAuth2 mode accepts active tokens", async () => {
  const server = createOauthTestServer({ ok: true, metadata: { subject: "user-123" } });
  await server.start();

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: "Bearer oauth-test-token"
      },
      body: JSON.stringify(initializeRequestPayload())
    });

    assert.equal(response.status, 200);
  } finally {
    await server.close();
  }
});
