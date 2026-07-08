import { users } from "@shared/schema";
import type { Logger } from "pino";

// Infer User type from Drizzle schema to ensure type safety
// This keeps the Express User type in sync with the database schema
type UserFromSchema = typeof users.$inferSelect;

// Extend Express Request to include typed User
declare global {
  namespace Express {
    interface Request {
      id: string;
      log: Logger;
    }
    interface User extends UserFromSchema {}
  }
}
