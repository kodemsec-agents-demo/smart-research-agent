import { MCPClient } from "@mastra/mcp";

export const mcpClient = new MCPClient({
  id: "research-mcp-client",
  servers: {
    // GitHub MCP server — browse repos, issues, PRs
    github: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN ?? "",
      },
    },
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
