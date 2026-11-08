import { Agent } from "@mastra/core/agent";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { mcpClient } from "../mcp/client.js";
import { getGatewayToken, listGatewayTools } from "../mcp/gateway.js";

// The model runs behind the agents' LLM gateway, whose inference endpoint
// speaks the OpenAI API; the stack sets its URL
const LLM_GATEWAY_URL = process.env.RESEARCH_LLM_GATEWAY_URL;
if (!LLM_GATEWAY_URL) throw new Error("RESEARCH_LLM_GATEWAY_URL is not set: the stack sets it for the LLM gateway");
const MODEL_ID = "openai.gpt-oss-120b-1:0";

const llmGateway = createOpenAICompatible({
  name: "agents-llm",
  baseURL: LLM_GATEWAY_URL,
  // The LLM gateway takes the same Cognito token as the tools' gateway, read
  // on every request, so a renewed one is used at once
  fetch: (url, init) => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${getGatewayToken()}`);
    return fetch(url, { ...init, headers });
  },
});

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
- **GitHub repositories**: Ask questions about public GitHub repositories and read their documentation via the DeepWiki MCP server.
- **Filesystem**: Navigate and read files on the host filesystem via the filesystem MCP server.

Guidelines:
- Always cite your sources when presenting information from web searches.
- When writing reports, save them as markdown files in the workspace.
- For database queries, always use parameterized queries and never modify data.
- Break complex research tasks into steps: search, read, analyze, then synthesize.
- If a tool fails, explain the error and suggest an alternative approach.
- Be concise but thorough. Prioritize accuracy over speed.`,
  model: llmGateway(MODEL_ID),
  // The gateway's tools (web search, page fetching, files, database,
  // calculator and DeepWiki) and the local filesystem server's. Listed on each
  // call, as the gateway can only be reached within an invocation
  tools: async () => ({
    ...(await listGatewayTools()),
    ...(await mcpClient.listTools()),
  }),
});
