import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getVaultUserTokenIndexPath, normalizeAppName, normalizeUserIdForPath } from "../config/vaultAuthTokenIndex.js";

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

export function createMcpServer({ name, version, serviceClient }) {
  const server = new McpServer({
    name,
    version
  });

  const adminAuthKey = process.env.MCP_ADMIN_AUTH_KEY;
  const appName = normalizeAppName(process.env.APP_NAME ?? "skeleton");
  const defaultUserId = String(process.env.MCP_CONFIG_DEFAULT_USER_ID ?? "default").trim() || "default";

  function getScopeModel(userId = defaultUserId) {
    const resolvedUserId = String(userId ?? defaultUserId).trim() || defaultUserId;
    return {
      appName,
      userId: resolvedUserId,
      userIdPathSegment: normalizeUserIdForPath(resolvedUserId),
      postgres: {
        tableName: `${appName}_config`,
        primaryKey: ["user_id", "key"],
        scope: "app_and_user"
      },
      vault: {
        tokenIndexPath: getVaultUserTokenIndexPath(appName, resolvedUserId),
        scope: "app_and_user"
      }
    };
  }

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
    "service_connection_info",
    "Return MCP server and target service connection details.",
    {},
    withErrorHandling(async () => ({
      ok: true,
      status: 200,
      data: {
        server: {
          name,
          version,
          adminAuthConfigured: Boolean(adminAuthKey),
          scopeModel: getScopeModel()
        },
        service: serviceClient.getConnectionInfo()
      }
    }))
  );

  server.tool(
    "service_scope_info",
    "Return app/user scoping metadata used by Postgres config and Vault token index paths.",
    {
      userId: z.string().min(1).optional()
    },
    withErrorHandling(async ({ userId }) => ({
      ok: true,
      status: 200,
      data: getScopeModel(userId)
    }))
  );

  server.tool(
    "service_list_endpoints",
    "List documented/implemented target service HTTP endpoints exposed by this MCP server.",
    {},
    withErrorHandling(async () => ({
      ok: true,
      status: 200,
      data: {
        endpoints: serviceClient.listKnownEndpoints()
      }
    }))
  );

  server.tool(
    "service_health_check",
    "Call target service health check endpoint.",
    {},
    withErrorHandling(async () => ({
      ok: true,
      status: 200,
      data: await serviceClient.healthCheck()
    }))
  );

  server.tool(
    "service_suspend_logging",
    "Suspend logging for a target service resource id via PUT /api/car/:id/logging/suspend.",
    {
      carId: z.union([z.string().min(1), z.number().int().positive()]),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ carId, authorizationKey }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await serviceClient.suspendLogging(carId)
      };
    })
  );

  server.tool(
    "service_resume_logging",
    "Resume logging for a target service resource id via PUT /api/car/:id/logging/resume.",
    {
      carId: z.union([z.string().min(1), z.number().int().positive()]),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ carId, authorizationKey }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await serviceClient.resumeLogging(carId)
      };
    })
  );

  server.tool(
    "service_get_drive_gpx",
    "Fetch a drive GPX export by id from GET /drive/:id/gpx.",
    {
      driveId: z.union([z.string().min(1), z.number().int().positive()])
    },
    withErrorHandling(async ({ driveId }) => ({
      ok: true,
      status: 200,
      data: await serviceClient.getDriveGpx(driveId)
    }))
  );

  server.tool(
    "service_api_request",
    "Generic target service HTTP API call. Supports all available endpoints while enforcing host/auth safeguards.",
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
        data: await serviceClient.request({
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
