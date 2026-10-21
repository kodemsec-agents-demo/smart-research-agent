import { Agent } from "@mastra/core/agent";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

import { webSearchTool } from "../tools/web-search.js";
import { readFileTool, writeFileTool } from "../tools/file-ops.js";
import { dbQueryTool } from "../tools/db-query.js";
import { fetchAndSummarizeTool } from "../tools/summarize.js";
import { calculatorTool } from "../tools/calculator.js";
import { mcpClient } from "../mcp/client.js";

const bedrock = createAmazonBedrock({
  credentialProvider: fromNodeProviderChain(),
});

const mcpTools = await mcpClient.listTools();

export const researchAgent = new Agent({
  id: "smart-research-agent",
  name: "Smart Research Agent",
  instructions: `You are a versatile research assistant with access to a wide range of tools.

Your capabilities:
- **Web Search**: Search the internet for current information on any topic.
- **Page Fetching**: Read and extract content from any public web page or documentation.
- **File Operations**: Read and write files in the workspace for storing research, notes, and reports.
- **Database Queries**: Run read-only SQL queries against a PostgreSQL database to explore data.
- **Calculator**: Evaluate mathematical expressions for data analysis.
- **GitHub**: Browse repositories, read issues, pull requests, and code via the GitHub MCP server.
- **Filesystem**: Navigate and read files on the host filesystem via the filesystem MCP server.

Guidelines:
- Always cite your sources when presenting information from web searches.
- When writing reports, save them as markdown files in the workspace.
- For database queries, always use parameterized queries and never modify data.
- Break complex research tasks into steps: search, read, analyze, then synthesize.
- If a tool fails, explain the error and suggest an alternative approach.
- Be concise but thorough. Prioritize accuracy over speed.`,
  model: bedrock("us.anthropic.claude-haiku-5-5"),
  tools: {
    webSearchTool,
    readFileTool,
    writeFileTool,
    dbQueryTool,
    fetchAndSummarizeTool,
    calculatorTool,
    ...mcpTools,
  },
});
