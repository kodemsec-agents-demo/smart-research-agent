import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const dbQueryTool = createTool({
  id: "db-query",
  description:
    "Execute a read-only SQL query against the configured PostgreSQL database. Only SELECT statements are allowed.",
  inputSchema: z.object({
    sql: z.string().describe("A read-only SQL SELECT statement"),
    params: z
      .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .default([])
      .describe("Positional parameters for the query ($1, $2, ...)"),
  }),
  outputSchema: z.object({
    columns: z.array(z.string()),
    rows: z.array(z.record(z.unknown())),
    rowCount: z.number(),
  }),
  execute: async ({ sql, params }) => {
    const trimmed = sql.trim().toLowerCase();
    if (!trimmed.startsWith("select") && !trimmed.startsWith("with")) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
      };
    }

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return {
        columns: ["error"],
        rows: [{ error: "DATABASE_URL is not configured" }],
        rowCount: 0,
      };
    }

    // Dynamic import so the agent works even without pg installed
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString });

    try {
      await client.connect();
      await client.query("SET statement_timeout = '10s'");
      await client.query("SET default_transaction_read_only = on");

      const result = await client.query(sql, params);
      const columns = result.fields.map((f: { name: string }) => f.name);

      return {
        columns,
        rows: result.rows as Record<string, unknown>[],
        rowCount: result.rowCount ?? 0,
      };
    } finally {
      await client.end();
    }
  },
});
