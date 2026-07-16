import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizeMethod(method) {
  return String(method ?? "GET").trim().toUpperCase();
}

function normalizePath(path) {
  const raw = String(path ?? "").trim();
  if (!raw) {
    return "/";
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function createMcpServer({ name, version, teslamateClient }) {
  const server = new McpServer({
    name,
    version
  });

  const adminAuthKey = process.env.MCP_ADMIN_AUTH_KEY;

  function asText(value) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(value, null, 2)
        }
      ]
    };
  }

  function classifyToolError(error) {
    const status = Number(error?.status ?? error?.statusCode ?? 500);
    const message = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      status: Number.isFinite(status) ? status : 500,
      error: message
    };
  }

  function withErrorHandling(handler) {
    return async (args) => {
      try {
        return asText(await handler(args));
      } catch (error) {
        return {
          ...asText(classifyToolError(error)),
          isError: true
        };
      }
    };
  }

  function assertAuthorized(authorizationKey) {
    if (!adminAuthKey) {
      return;
    }

    if (!authorizationKey || authorizationKey !== adminAuthKey) {
      const unauthorized = new Error("Unauthorized: invalid authorizationKey for mutating API operation");
      unauthorized.status = 401;
      throw unauthorized;
    }
  }

  server.tool(
    "teslamate_connection_info",
    "Return TeslaMate MCP server and target TeslaMate instance connection details.",
    {},
    withErrorHandling(async () => ({
      ok: true,
      status: 200,
      data: {
        server: {
          name,
          version,
          adminAuthConfigured: Boolean(adminAuthKey)
        },
        teslamate: teslamateClient.getConnectionInfo()
      }
    }))
  );

  server.tool(
    "teslamate_list_endpoints",
    "List documented/implemented TeslaMate HTTP endpoints exposed by this MCP server.",
    {},
    withErrorHandling(async () => ({
      ok: true,
      status: 200,
      data: {
        endpoints: teslamateClient.listKnownEndpoints()
      }
    }))
  );

  server.tool(
    "teslamate_health_check",
    "Call TeslaMate health check endpoint.",
    {},
    withErrorHandling(async () => ({
      ok: true,
      status: 200,
      data: await teslamateClient.healthCheck()
    }))
  );

  server.tool(
    "teslamate_suspend_logging",
    "Suspend logging for a TeslaMate car id via PUT /api/car/:id/logging/suspend.",
    {
      carId: z.union([z.string().min(1), z.number().int().positive()]),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ carId, authorizationKey }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await teslamateClient.suspendLogging(carId)
      };
    })
  );

  server.tool(
    "teslamate_resume_logging",
    "Resume logging for a TeslaMate car id via PUT /api/car/:id/logging/resume.",
    {
      carId: z.union([z.string().min(1), z.number().int().positive()]),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ carId, authorizationKey }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await teslamateClient.resumeLogging(carId)
      };
    })
  );

  server.tool(
    "teslamate_get_drive_gpx",
    "Fetch a drive GPX export by id from GET /drive/:id/gpx.",
    {
      driveId: z.union([z.string().min(1), z.number().int().positive()])
    },
    withErrorHandling(async ({ driveId }) => ({
      ok: true,
      status: 200,
      data: await teslamateClient.getDriveGpx(driveId)
    }))
  );

  server.tool(
    "teslamate_api_request",
    "Generic TeslaMate HTTP API call. Supports all available TeslaMate endpoints while enforcing host/auth safeguards.",
    {
      method: z.string().min(1),
      path: z.string().min(1),
      query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
      body: z.unknown().optional(),
      headers: z.record(z.string(), z.string()).optional(),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ method, path, query, body, headers, authorizationKey }) => {
      const normalizedMethod = normalizeMethod(method);
      const normalizedPath = normalizePath(path);

      if (MUTATING_METHODS.has(normalizedMethod)) {
        assertAuthorized(authorizationKey);
      }

      return {
        ok: true,
        status: 200,
        data: await teslamateClient.request({
          method: normalizedMethod,
          path: normalizedPath,
          query,
          body,
          headers
        })
      };
    })
  );

  return server;
}
