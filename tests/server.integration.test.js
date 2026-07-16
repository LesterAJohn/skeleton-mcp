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

function createTeslaMateClientMock() {
  const calls = {
    suspend: 0,
    resume: 0,
    request: 0
  };

  const client = {
    getConnectionInfo() {
      return {
        baseUrl: "http://127.0.0.1:4000",
        authMode: "none"
      };
    },
    listKnownEndpoints() {
      return [{ method: "GET", path: "/health_check" }];
    },
    async healthCheck() {
      return { status: 200, data: null };
    },
    async suspendLogging(carId) {
      calls.suspend += 1;
      return { ok: true, carId };
    },
    async resumeLogging(carId) {
      calls.resume += 1;
      return { ok: true, carId };
    },
    async getDriveGpx(driveId) {
      return { status: 200, data: `<gpx id=\"${driveId}\"/>` };
    },
    async request(payload) {
      calls.request += 1;
      return {
        status: 200,
        ...payload
      };
    }
  };

  return { client, calls };
}

async function invokeTool(server, name, args = {}) {
  const registeredTools = server._registeredTools;
  assert.ok(registeredTools[name], `Expected tool ${name} to be registered`);
  const result = await registeredTools[name].handler(args);
  const payload = JSON.parse(result.content[0].text);
  return { result, payload };
}

test("teslamate_health_check returns ok", async () => {
  const restoreEnv = setEnv({ MCP_ADMIN_AUTH_KEY: "" });

  try {
    const { client } = createTeslaMateClientMock();
    const server = createMcpServer({
      name: "teslamate-mcp",
      version: "0.1.0",
      teslamateClient: client
    });

    const { payload } = await invokeTool(server, "teslamate_health_check");

    assert.equal(payload.ok, true);
    assert.equal(payload.status, 200);
    assert.equal(payload.data.status, 200);
  } finally {
    restoreEnv();
  }
});

test("mutating TeslaMate tools require authorizationKey when admin key is configured", async () => {
  const restoreEnv = setEnv({ MCP_ADMIN_AUTH_KEY: "super-secret" });

  try {
    const { client, calls } = createTeslaMateClientMock();
    const server = createMcpServer({
      name: "teslamate-mcp",
      version: "0.1.0",
      teslamateClient: client
    });

    const unauthorized = await invokeTool(server, "teslamate_suspend_logging", {
      carId: 1
    });
    assert.equal(unauthorized.result.isError, true);
    assert.equal(unauthorized.payload.status, 401);

    const authorized = await invokeTool(server, "teslamate_suspend_logging", {
      carId: 1,
      authorizationKey: "super-secret"
    });
    assert.equal(authorized.payload.ok, true);
    assert.equal(calls.suspend, 1);

    const genericUnauthorized = await invokeTool(server, "teslamate_api_request", {
      method: "POST",
      path: "/api/car/1/logging/suspend"
    });
    assert.equal(genericUnauthorized.result.isError, true);
    assert.equal(genericUnauthorized.payload.status, 401);

    const genericAuthorized = await invokeTool(server, "teslamate_api_request", {
      method: "POST",
      path: "/api/car/1/logging/suspend",
      authorizationKey: "super-secret"
    });
    assert.equal(genericAuthorized.payload.ok, true);
    assert.equal(calls.request, 1);
  } finally {
    restoreEnv();
  }
});
