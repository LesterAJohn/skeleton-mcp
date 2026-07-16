import { env } from "../config/env.js";
import { resolveVaultAgentRuntimeConfig } from "../config/vaultAgentRuntime.js";
import { createHttpMcpServer } from "./server.js";
import { createOAuth2IntrospectionVerifier } from "./oauth2.js";
import { createVaultTokenVerifier } from "./vaultTokenAuth.js";
import { createMcpServer } from "../mcp/server.js";
import { ConfigStore } from "../services/configStore.js";
import { VaultService } from "../services/vault.js";

async function main() {
  if (env.transport.http.tls.enabled) {
    throw new Error(
      "MCP_HTTP_TLS_ENABLED=true is not supported in this process mode. Terminate TLS at a reverse proxy/load balancer."
    );
  }

  const configStore = new ConfigStore(env.postgres, {
    defaultUserId: env.config.defaultUserId,
    tableName: env.postgres.configTable
  });
  const vaultAgentRuntime = await resolveVaultAgentRuntimeConfig({ configStore, env });
  const vaultService = new VaultService({
    ...env.vault,
    agentEnabled: vaultAgentRuntime.enabled,
    agentAuthMode: vaultAgentRuntime.authMode,
    agentTokenFilePath: vaultAgentRuntime.tokenFilePath,
    agentListenerEnabled: vaultAgentRuntime.listenerEnabled,
    agentListenerAddr: vaultAgentRuntime.listenerAddr
  });
  const tokenVerifier =
    (env.transport.http.authMode === "token" || env.transport.http.authMode === "both") &&
    env.transport.http.tokenSource === "vault"
      ? createVaultTokenVerifier({
          vaultService,
          indexPath: env.transport.http.vaultToken.indexPath,
          defaultUserId: env.transport.http.vaultToken.defaultUserId,
          requiredScopes: env.transport.http.vaultToken.requiredScopes,
          requiredAudience: env.transport.http.vaultToken.requiredAudience,
          cacheTtlMs: env.transport.http.vaultToken.cacheTtlMs
        })
      : undefined;
  const oauth2Verifier =
    env.transport.http.authMode === "oauth2" || env.transport.http.authMode === "both"
      ? createOAuth2IntrospectionVerifier({
          introspectionUrl: env.transport.http.oauth2.introspectionUrl,
          clientId: env.transport.http.oauth2.clientId,
          clientSecret: env.transport.http.oauth2.clientSecret,
          requiredScopes: env.transport.http.oauth2.requiredScopes,
          requiredAudience: env.transport.http.oauth2.requiredAudience,
          timeoutMs: env.transport.http.oauth2.timeoutMs,
          cacheTtlMs: env.transport.http.oauth2.cacheTtlMs
        })
      : undefined;

  const httpServer = createHttpMcpServer({
    host: env.transport.http.host,
    port: env.transport.http.port,
    mcpPath: env.transport.http.mcpPath,
    healthPath: env.transport.http.healthPath,
    authMode: env.transport.http.authMode,
    tokenVerifier,
    authTokens: env.transport.http.authTokens,
    oauth2Verifier,
    trustedProxy: env.transport.http.trustedProxy,
    allowedOrigins: env.transport.http.allowedOrigins,
    allowedIps: env.transport.http.allowedIps,
    maxBodyBytes: env.transport.http.maxBodyBytes,
    rateLimitWindowMs: env.transport.http.rateLimitWindowMs,
    rateLimitMaxRequests: env.transport.http.rateLimitMaxRequests,
    createMcpServer: () =>
      createMcpServer({
        name: env.mcpServerName,
        version: env.mcpServerVersion,
        configStore,
        vaultService
      })
  });

  await httpServer.start();

  console.log(
    `HTTP MCP server listening on http://${httpServer.host}:${httpServer.port}${httpServer.mcpPath}`
  );

  const shutdown = async () => {
    await httpServer.close();
    await configStore.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("HTTP MCP server failed to start", error);
  process.exit(1);
});
