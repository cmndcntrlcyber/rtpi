import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";
import dotenv from "dotenv";
import { createLogger } from "./lib/logger";

const log = createLogger("db");

// Ensure environment variables are loaded
dotenv.config();

const connectionString = process.env.DATABASE_URL || "postgresql://rtpi:rtpi@localhost:5434/rtpi_main";

// Create postgres client.
// idle_timeout/max_lifetime force the pool to recycle sockets BEFORE Docker
// NAT / pg tcp_keepalives_idle / pgbouncer kill them out from under us, which
// otherwise causes scheduled jobs (e.g. OllamaManager's 5-minute tick) to
// surface `write CONNECTION_ENDED` on the first query after a long idle.
//
// max=10 caps the pool so a runaway cron can't exhaust the server's
// max_connections; prepare=false disables postgres-js's prepared-statement
// cache, which is the codepath that's been observed to hold onto a dead
// socket and surface the long-idle `write CONNECTION_ENDED` errors. The
// performance hit on rtpi's traffic profile is negligible (small per-tick
// query volume); the connection-stability win is large.
export const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 60,
  max_lifetime: 60 * 30,
  connect_timeout: 10,
  prepare: false,
  connection: { application_name: "rtpi-server" },
});

// Create drizzle instance
export const db = drizzle(client, { schema });

// Single-shot health check (used by health endpoints)
export async function checkDatabaseConnection() {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    log.error({ err: error }, "Database connection failed");
    return false;
  }
}

// Startup check with retry (used by initializeServer)
export async function waitForDatabase(): Promise<void> {
  const { retryWithBackoff } = await import("./lib/retry");
  await retryWithBackoff(
    async () => {
      const ok = await checkDatabaseConnection();
      if (!ok) throw new Error("Database connection check returned false");
    },
    {
      maxRetries: 10,
      initialDelayMs: 1000,
      maxDelayMs: 30_000,
      label: "database",
    },
  );
}
