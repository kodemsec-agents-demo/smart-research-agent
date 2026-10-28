import type { Context } from "aws-lambda";

import { calculator } from "./tools/calculator.js";
import { dbQuery } from "./tools/db-query.js";
import { readFileTool, writeFileTool } from "./tools/file-ops.js";
import { fetchAndSummarize } from "./tools/summarize.js";
import { webSearch } from "./tools/web-search.js";

// The tools of the gateway's research-tools target, by the names in tool_schema.json
const TOOLS: Record<string, (input: never) => Promise<unknown>> = {
  "web-search": webSearch,
  "fetch-and-summarize": fetchAndSummarize,
  "read-file": readFileTool,
  "write-file": writeFileTool,
  "db-query": dbQuery,
  calculator,
};

interface CustomContext {
  bedrockAgentCoreToolName?: string;
}

// The gateway names the tool "<target>___<tool>"
const TOOL_NAME_SEPARATOR = "___";

/**
 * Runs one tool call from the AgentCore gateway.
 *
 * @param event The tool's arguments, as the gateway passes them.
 * @param context The Lambda context; its client context names the tool.
 * @returns The tool's result.
 * @throws Error The gateway named a tool this Lambda doesn't have.
 */
export const handler = async (event: never, context: Context) => {
  // Lambda passes the client context as the gateway sent it ("custom"); its types say "Custom"
  const clientContext = context.clientContext as { custom?: CustomContext; Custom?: CustomContext } | undefined;
  const fullName = String((clientContext?.custom ?? clientContext?.Custom)?.bedrockAgentCoreToolName ?? "");
  const name = fullName.split(TOOL_NAME_SEPARATOR).pop() ?? "";
  const tool = TOOLS[name];

  if (!tool) {
    throw new Error(`Unknown tool "${fullName}"; this target serves ${Object.keys(TOOLS).join(", ")}`);
  }

  return tool(event);
};
