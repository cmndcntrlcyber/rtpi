import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcrypt";
import { db } from "../../db";
import { users } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { createLogger } from '../../lib/logger';
const log = createLogger("create-admin");

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
      log.info(`✅ Admin user '${username}' already exists`);
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

    log.info(`✅ Created default admin user`);
    log.info(`   Username: ${username}`);
    log.info(`   Email: ${email}`);
    log.info(`   Password: ${password}`);
    log.info(`\n⚠️  Please change this password after first login!`);
    
    process.exit(0);
  } catch (error) {
    log.error("Failed to create admin user:", error);
    process.exit(1);
  }
}

createDefaultAdmin();
