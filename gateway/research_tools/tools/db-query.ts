import pg from "pg";

// Runs a read-only SQL query against the PostgreSQL database of DATABASE_URL
export async function dbQuery({
  sql,
  params = [],
}: {
  sql: string;
  params?: (string | number | boolean | null)[];
}) {
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
}
