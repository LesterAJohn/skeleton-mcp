import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { env } from "./config/env.js";
import { resolveVaultAgentRuntimeConfig } from "./config/vaultAgentRuntime.js";
import { createMcpServer } from "./mcp/server.js";
import { ConfigStore } from "./services/configStore.js";
import { VaultService } from "./services/vault.js";

async function main() {
  if (env.transport.mode === "http") {
    await import("./http/index.js");
    return;
  }

  if (env.transport.mode === "both") {
    await import("./start-both.js");
    return;
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

  const server = createMcpServer({
    name: env.mcpServerName,
    version: env.mcpServerVersion,
    configStore,
    vaultService
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async () => {
    await configStore.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("MCP server failed to start", error);
  process.exit(1);
});
