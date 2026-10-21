import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export const readFileTool = createTool({
  id: "read-file",
  description:
    "Read the contents of a file from the workspace. Supports text files such as .txt, .json, .csv, .md, and code files.",
  inputSchema: z.object({
    path: z.string().describe("Relative path to the file within the workspace"),
    encoding: z
      .enum(["utf-8", "base64"])
      .default("utf-8")
      .describe("How to decode the file"),
  }),
  outputSchema: z.object({
    content: z.string(),
    size: z.number(),
  }),
  execute: async ({ path, encoding }) => {
    const workspaceRoot = process.env.WORKSPACE_DIR ?? "/tmp/workspace";
    const fullPath = `${workspaceRoot}/${path}`;

    const buf = await readFile(fullPath);
    const content = buf.toString(encoding as BufferEncoding);
    return { content, size: buf.length };
  },
});

export const writeFileTool = createTool({
  id: "write-file",
  description:
    "Write content to a file in the workspace. Creates parent directories if they don't exist.",
  inputSchema: z.object({
    path: z.string().describe("Relative path to the file within the workspace"),
    content: z.string().describe("The content to write"),
  }),
  outputSchema: z.object({
    path: z.string(),
    bytesWritten: z.number(),
  }),
  execute: async ({ path, content }) => {
    const workspaceRoot = process.env.WORKSPACE_DIR ?? "/tmp/workspace";
    const fullPath = `${workspaceRoot}/${path}`;

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf-8");
    return { path, bytesWritten: Buffer.byteLength(content) };
  },
});
