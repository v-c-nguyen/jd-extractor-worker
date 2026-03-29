import { neon } from "@neondatabase/serverless";

let sql: ReturnType<typeof neon> | null = null;

/** Neon over HTTPS — avoids WebSocket/`ws`/`bufferutil` issues on Windows + Next.js bundling. */
export function getSql() {
  if (!sql) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString?.trim()) {
      throw new Error("DATABASE_URL is not set");
    }
    sql = neon(connectionString);
  }
  return sql;
}
