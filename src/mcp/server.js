import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { redactObject } from "../services/security.js";

export function createMcpServer({ name, version, configStore, vaultService }) {
  const server = new McpServer({
    name,
    version
  });

  const allowSensitiveOutput =
    String(process.env.MCP_ALLOW_SENSITIVE_OUTPUT ?? "").toLowerCase() === "true";
  const adminAuthKey = process.env.MCP_ADMIN_AUTH_KEY;

  function asText(value) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(redactObject(value, allowSensitiveOutput), null, 2)
        }
      ]
    };
  }

  function classifyToolError(error) {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();
    const status = normalized.includes("unauthorized") ? 401 : 500;

    return {
      ok: false,
      status,
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
      throw new Error("Unauthorized: invalid authorizationKey for admin operation");
    }
  }

  server.tool(
    "connection_info",
    "Return MCP server, Vault, and Postgres connection information with secret-safe values.",
    {},
    withErrorHandling(async () => ({
      ok: true,
      status: 200,
      data: {
        server: {
          name,
          version,
          allowSensitiveOutput,
          adminAuthConfigured: Boolean(adminAuthKey),
          configDefaultUserId: process.env.MCP_CONFIG_DEFAULT_USER_ID ?? "default"
        },
        vault: vaultService.getConnectionInfo(),
        postgres: {
          host: process.env.POSTGRES_HOST ?? null,
          port: process.env.POSTGRES_PORT ?? null,
          database: process.env.POSTGRES_DB ?? null,
          user: process.env.POSTGRES_USER ? "set" : null,
          password: process.env.POSTGRES_PASSWORD ? "set" : null
        }
      }
    }))
  );

  server.tool(
    "healthcheck",
    "Run connectivity checks for Postgres and Vault.",
    {},
    withErrorHandling(async () => {
      await Promise.all([configStore.healthcheck(), vaultService.healthcheck()]);
      return {
        ok: true,
        status: 200,
        data: {
          postgres: "ok",
          vault: "ok"
        }
      };
    })
  );

  server.tool(
    "list_configs",
    "List configuration records from Postgres for a user scope, optionally filtered by key prefix.",
    {
      prefix: z.string().min(1).optional(),
      userId: z.string().min(1).optional()
    },
    withErrorHandling(async ({ prefix, userId }) => ({
      ok: true,
      status: 200,
      data: await configStore.listConfigs(prefix, userId)
    }))
  );

  server.tool(
    "get_config",
    "Read a configuration value from Postgres by key and user scope.",
    {
      key: z.string().min(1),
      userId: z.string().min(1).optional()
    },
    withErrorHandling(async ({ key, userId }) => {
      const config = await configStore.getConfig(key, userId);
      if (!config) {
        return {
          ok: false,
          status: 404,
          error: `No config found for key: ${key} in user scope: ${userId ?? "default"}`
        };
      }

      return { ok: true, status: 200, data: config };
    })
  );

  server.tool(
    "set_config",
    "Create or update a configuration value in Postgres for a user scope.",
    {
      key: z.string().min(1),
      value: z.unknown(),
      userId: z.string().min(1).optional(),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ key, value, userId, authorizationKey }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await configStore.setConfig(key, value, userId)
      };
    })
  );

  server.tool(
    "delete_config",
    "Delete a configuration value from Postgres by key and user scope.",
    {
      key: z.string().min(1),
      userId: z.string().min(1).optional(),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ key, userId, authorizationKey }) => {
      assertAuthorized(authorizationKey);
      const deleted = await configStore.deleteConfig(key, userId);
      return {
        ok: true,
        status: 200,
        data: { key, userId: userId ?? "default", deleted }
      };
    })
  );

  server.tool(
    "vault_connection_info",
    "Return active Vault configuration without exposing secret values.",
    {},
    withErrorHandling(async () => ({
      ok: true,
      status: 200,
      data: vaultService.getConnectionInfo()
    }))
  );

  server.tool(
    "list_secrets",
    "List child keys under a Vault path prefix.",
    {
      prefix: z.string().optional()
    },
    withErrorHandling(async ({ prefix }) => ({
      ok: true,
      status: 200,
      data: { keys: await vaultService.listSecrets(prefix) }
    }))
  );

  server.tool(
    "get_secret",
    "Read a secret from Vault KV v2 by path.",
    {
      path: z.string().min(1)
    },
    withErrorHandling(async ({ path }) => {
      const secret = await vaultService.getSecret(path);
      if (!secret) {
        return { ok: false, status: 404, error: `No secret found at path: ${path}` };
      }

      return {
        ok: true,
        status: 200,
        data: secret
      };
    })
  );

  server.tool(
    "set_secret",
    "Create or update a Vault secret at path.",
    {
      path: z.string().min(1),
      value: z.record(z.string(), z.unknown()),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ path, value, authorizationKey }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await vaultService.setSecret(path, value)
      };
    })
  );

  server.tool(
    "delete_secret",
    "Delete a Vault secret at path.",
    {
      path: z.string().min(1),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ path, authorizationKey }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await vaultService.deleteSecret(path)
      };
    })
  );

  return server;
}
