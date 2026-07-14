import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { env } from "./config/env.js";
import { createMcpServer } from "./mcp/server.js";
import { ConfigStore } from "./services/configStore.js";
import { VaultService } from "./services/vault.js";

async function main() {
  const configStore = new ConfigStore(env.postgres);
  const vaultService = new VaultService(env.vault);

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
