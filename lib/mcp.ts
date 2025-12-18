import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

let mcpClient: Client | null = null;

export async function getMcpClient() {
  if (mcpClient) {
    return mcpClient;
  }

  // Path to the MCP server executable
  // Assuming the app is running in the root of the demo folder
  // and the server is in ../metaplex-genesis-mcp/dist/index.js
  const serverPath = path.resolve(
    process.cwd(),
    "../metaplex-genesis-mcp/dist/index.js",
  );

  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
    env: {
      // Pass necessary env vars if needed. The server defaults to mainnet-beta if not set.
      // We want devnet for the demo as requested.
      SOLANA_RPC_URL: "https://api.devnet.solana.com",
    },
  });

  const client = new Client(
    {
      name: "metaplex-genesis-mcp-demo",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  await client.connect(transport);
  mcpClient = client;

  return client;
}

export async function callMcpTool(name: string, args: any) {
  const client = await getMcpClient();
  const result = await client.callTool({
    name,
    arguments: args,
  });
  return result;
}

export async function listMcpTools() {
  const client = await getMcpClient();
  const result = await client.listTools();
  return result.tools;
}

// Helper to format tools for the LLM System Prompt
export async function getToolsDescription() {
  const tools = await listMcpTools();
  return tools
    .map((t) => {
      return `Tool: ${t.name}
Description: ${t.description}
Schema: ${JSON.stringify(t.inputSchema)}
`;
    })
    .join("\n\n");
}
