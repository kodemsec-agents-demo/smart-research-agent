import { MCPClient } from "@mastra/mcp";

// The local MCP servers, run in the agent's container. GitHub's remote MCP
// server is a target of the gateway (see gateway.ts)
export const mcpClient = new MCPClient({
  id: "research-mcp-client",
  servers: {
    // Filesystem MCP server — browse and read files on the host
    filesystem: {
      command: "npx",
      args: [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        process.env.WORKSPACE_DIR ?? "/tmp/workspace",
      ],
    },
  },
});
