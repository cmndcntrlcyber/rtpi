import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";
import dotenv from "dotenv";

// Ensure environment variables are loaded
dotenv.config();

const connectionString = process.env.DATABASE_URL || "postgresql://rtpi:rtpi@localhost:5432/rtpi_main";

// Create postgres client
export const client = postgres(connectionString);

// Create drizzle instance
export const db = drizzle(client, { schema });

// Health check function
export async function checkDatabaseConnection() {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}
