import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { env } from "./config/env.js";
import { createMcpServer } from "./mcp/server.js";
import { TeslaMateClient } from "./services/teslamate.js";

async function main() {
  if (env.transport.mode === "http") {
    await import("./http/index.js");
    return;
  }

  if (env.transport.mode === "both") {
    await import("./start-both.js");
    return;
  }

  const teslamateClient = new TeslaMateClient(env.teslamate);

  const server = createMcpServer({
    name: env.mcpServerName,
    version: env.mcpServerVersion,
    teslamateClient
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("MCP server failed to start", error);
  process.exit(1);
});
