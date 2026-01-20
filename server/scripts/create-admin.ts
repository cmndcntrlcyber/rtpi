import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcrypt";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

async function createDefaultAdmin() {
  try {
    const username = process.env.DEFAULT_ADMIN_USERNAME || "admin";
    const email = process.env.DEFAULT_ADMIN_EMAIL || "admin@rtpi.local";
    const password = process.env.DEFAULT_ADMIN_PASSWORD || "Admin123!@#";

    // Check if admin already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser.length > 0) {
      console.log(`✅ Admin user '${username}' already exists`);
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create admin user
    await db.insert(users).values({
      username,
      email,
      passwordHash,
      role: "admin",
      authMethod: "local",
      isActive: true,
      mustChangePassword: false,
    });

    console.log(`✅ Created default admin user`);
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`\n⚠️  Please change this password after first login!`);
    
    process.exit(0);
  } catch (error) {
    console.error("Failed to create admin user:", error);
    process.exit(1);
  }
}

createDefaultAdmin();
