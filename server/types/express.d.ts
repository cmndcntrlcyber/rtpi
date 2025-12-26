import { users } from "@shared/schema";

// Infer User type from Drizzle schema to ensure type safety
// This keeps the Express User type in sync with the database schema
type UserFromSchema = typeof users.$inferSelect;

// Extend Express Request to include typed User
declare global {
  namespace Express {
    interface User extends UserFromSchema {}
  }
}
