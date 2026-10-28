import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// Reads a file from the workspace
export async function readFileTool({
  path,
  encoding = "utf-8",
}: {
  path: string;
  encoding?: "utf-8" | "base64";
}) {
  const workspaceRoot = process.env.WORKSPACE_DIR ?? "/tmp/workspace";
  const fullPath = `${workspaceRoot}/${path}`;

  const buf = await readFile(fullPath);
  const content = buf.toString(encoding as BufferEncoding);
  return { content, size: buf.length };
}

// Writes a file to the workspace, creating its parent directories
export async function writeFileTool({ path, content }: { path: string; content: string }) {
  const workspaceRoot = process.env.WORKSPACE_DIR ?? "/tmp/workspace";
  const fullPath = `${workspaceRoot}/${path}`;

  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf-8");
  return { path, bytesWritten: Buffer.byteLength(content) };
}
