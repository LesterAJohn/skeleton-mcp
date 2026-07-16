import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createBearerToken, createVaultTokenEntry, getVaultTokenIndexPath, mergeVaultTokenIndex, normalizeAppName } from "../config/vaultAuthTokenIndex.js";
import { env } from "../config/env.js";
import { redactObject } from "../services/security.js";

export function createMcpServer({ name, version, configStore, vaultService }) {
  const server = new McpServer({
    name,
    version
  });

  const allowSensitiveOutput = String(process.env.MCP_ALLOW_SENSITIVE_OUTPUT ?? "").toLowerCase() === "true";
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

    return { ok: false, status, error: message };
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

  async function seedVaultToken({
    token,
    userId,
    tokenId,
    scopes,
    audience,
    expiresAt,
    path,
    tokenType,
    authorizationKey,
    includeTokenInResponse
  }) {
    assertAuthorized(authorizationKey);

    const appName = normalizeAppName(env.appName);
    const indexPath = path ?? env.vault.tokenIndexPath ?? getVaultTokenIndexPath(appName);
    const { tokenHash, entry } = createVaultTokenEntry({
      userId: userId ?? env.config.defaultUserId,
      tokenId,
      token,
      scopes,
      audience,
      expiresAt,
      tokenType
    });

    const existingPayload = await vaultService.getSecret(indexPath).catch((error) => {
      const message = String(error?.message ?? "");
      if (message.includes("404")) {
        return null;
      }

      throw error;
    });

    const payload = mergeVaultTokenIndex(existingPayload, {
      userId: userId ?? env.config.defaultUserId,
      tokenHash,
      entry
    });

    await vaultService.setSecret(indexPath, payload);

    return {
      ok: true,
      status: 200,
      data: includeTokenInResponse
        ? {
            token,
            tokenHash,
            indexPath,
            userId: entry.userId,
            tokenId: entry.tokenId,
            scopes: entry.scopes,
            audience: entry.audience,
            expiresAt: entry.expiresAt ?? null
          }
        : {
            tokenHash,
            indexPath,
            userId: entry.userId,
            tokenId: entry.tokenId,
            scopes: entry.scopes,
            audience: entry.audience,
            expiresAt: entry.expiresAt ?? null
          }
    };
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
          configDefaultUserId: process.env.MCP_CONFIG_DEFAULT_USER_ID ?? "default",
          tokenRotationDefaultIntervalMs: Number(process.env.MCP_TOKEN_ROTATION_DEFAULT_INTERVAL_MS ?? "86400000"),
          tokenRotationUserIntervalConfigKey:
            process.env.MCP_TOKEN_ROTATION_USER_INTERVAL_CONFIG_KEY ?? "token.rotation.intervalMs"
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
        return { ok: false, status: 404, error: `No config found for key: ${key} in user scope: ${userId ?? "default"}` };
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
    "vault_agent_token_read",
    "Read Vault Agent token sink content for application token consumption. Requires admin authorization.",
    {
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ authorizationKey }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await vaultService.readAgentToken()
      };
    })
  );

  server.tool(
    "token_lookup_self",
    "Call Vault tokenLookupSelf via node-vault. Requires admin authorization.",
    {
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ authorizationKey }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await vaultService.tokenLookupSelf()
      };
    })
  );

  server.tool(
    "token_renew_self",
    "Call Vault tokenRenewSelf via node-vault. Requires admin authorization.",
    {
      increment: z.string().min(1).optional(),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ increment, authorizationKey }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await vaultService.tokenRenewSelf(increment)
      };
    })
  );

  server.tool(
    "token_create",
    "Call Vault tokenCreate via node-vault. Requires admin authorization.",
    {
      role_name: z.string().min(1).optional(),
      policies: z.array(z.string().min(1)).optional(),
      ttl: z.string().min(1).optional(),
      period: z.string().min(1).optional(),
      renewable: z.boolean().optional(),
      explicit_max_ttl: z.string().min(1).optional(),
      num_uses: z.number().int().nonnegative().optional(),
      display_name: z.string().min(1).optional(),
      meta: z.record(z.string(), z.string()).optional(),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ authorizationKey, ...options }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await vaultService.tokenCreate(options)
      };
    })
  );

  server.tool(
    "token_revoke",
    "Call Vault tokenRevoke via node-vault for the specified token. Requires admin authorization.",
    {
      token: z.string().min(1),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ token, authorizationKey }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await vaultService.tokenRevoke(token)
      };
    })
  );

  server.tool(
    "token_revoke_self",
    "Call Vault tokenRevokeSelf via node-vault. Requires admin authorization.",
    {
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ authorizationKey }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await vaultService.tokenRevokeSelf()
      };
    })
  );

  server.tool(
    "vault_seed_http_token",
    "Generate an opaque bearer token and store it in the Vault HTTP token index for a user. Requires admin authorization.",
    {
      userId: z.string().min(1).optional(),
      tokenId: z.string().min(1).optional(),
      scopes: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
      audience: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
      expiresAt: z.string().min(1).optional(),
      path: z.string().min(1).optional(),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ userId, tokenId, scopes, audience, expiresAt, path, authorizationKey }) =>
      seedVaultToken({
        token: createBearerToken(),
        userId,
        tokenId,
        scopes,
        audience,
        expiresAt,
        path,
        tokenType: "bearer",
        authorizationKey,
        includeTokenInResponse: true
      })
    )
  );

  server.tool(
    "vault_seed_oauth_token",
    "Store a provided OAuth access token in the Vault HTTP token index for a user. Requires admin authorization.",
    {
      token: z.string().min(1),
      userId: z.string().min(1).optional(),
      tokenId: z.string().min(1).optional(),
      scopes: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
      audience: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
      expiresAt: z.string().min(1).optional(),
      path: z.string().min(1).optional(),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ token, userId, tokenId, scopes, audience, expiresAt, path, authorizationKey }) =>
      seedVaultToken({
        token,
        userId,
        tokenId,
        scopes,
        audience,
        expiresAt,
        path,
        tokenType: "oauth2",
        authorizationKey,
        includeTokenInResponse: false
      })
    )
  );

  server.tool(
    "token_rotation_config",
    "Return effective token rotation interval from user-scoped config with default fallback.",
    {
      userId: z.string().min(1).optional()
    },
    withErrorHandling(async ({ userId }) => ({
      ok: true,
      status: 200,
      data: await configStore.getTokenRotationIntervalMs({
        userId,
        userIntervalConfigKey:
          process.env.MCP_TOKEN_ROTATION_USER_INTERVAL_CONFIG_KEY ?? "token.rotation.intervalMs",
        defaultIntervalMs: Number(process.env.MCP_TOKEN_ROTATION_DEFAULT_INTERVAL_MS ?? "86400000")
      })
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