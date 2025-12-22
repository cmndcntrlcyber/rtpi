import { db } from "../server/db";
import { users } from "@shared/schema";

async function createTestUser() {
  try {
    const hashedPassword = "$2b$10$pyu1jKWKVso5bqLh6/aYv.OhwXWT3IOrVTuvVPbIXOreytIeYeXFW"; // testpass123
    
    const result = await db.insert(users).values({
      username: "testuser",
      email: "test@example.com",
      passwordHash: hashedPassword,
      role: "admin",
      authMethod: "local",
      twoFactorEnabled: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    console.log("Test user created:", result);
    process.exit(0);
  } catch (error) {
    console.error("Error creating user:", error);
    process.exit(1);
  }
}

createTestUser();
