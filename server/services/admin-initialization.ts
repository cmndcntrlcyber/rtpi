import bcrypt from "bcrypt";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { createLogger } from '../lib/logger';
const log = createLogger("admin-initialization");

export async function initializeDefaultAdmin() {
  try {
    // Check if feature is enabled
    const generatePassword = process.env.GENERATE_ADMIN_PASSWORD === "true";
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || "Admin123!@";
    const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || "admin";
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@rtpi.local";

    // Check if admin user already exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.username, adminUsername))
      .limit(1);

    if (existingAdmin.length > 0) {
      log.info("✅ Admin user already exists");
      return;
    }

    // Generate or use default password
    let password: string;
    if (generatePassword) {
      // Generate secure random password (16 characters, alphanumeric + symbols)
      const randomBytes = crypto.randomBytes(12);
      password = randomBytes.toString('base64').slice(0, 16);
      log.info("🔐 Generated random admin password");
    } else {
      password = defaultPassword;
      log.info("🔐 Using default admin password from environment");
    }

    // Hash password with bcrypt (12 rounds for security)
    const passwordHash = await bcrypt.hash(password, 12);

    // Create admin user
    await db.insert(users).values({
      username: adminUsername,
      email: adminEmail,
      passwordHash,
      role: "admin",
      authMethod: "local",
      isActive: true,
      mustChangePassword: generatePassword, // Force password change if generated
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    log.info(`✅ Created admin user: ${adminUsername}`);

    // Write password to ~/admin_password.txt (only if generated)
    if (generatePassword) {
      const homeDir = os.homedir();
      const passwordFilePath = path.join(homeDir, "admin_password.txt");

      const fileContent = `RTPI Admin Credentials
Generated: ${new Date().toISOString()}

Username: ${adminUsername}
Email: ${adminEmail}
Password: ${password}

⚠️  IMPORTANT SECURITY NOTES:
1. This password is for FIRST-TIME LOGIN ONLY
2. You will be prompted to change it immediately after login
3. DELETE THIS FILE after logging in and changing your password
4. Never commit this file to version control

Login URL: http://localhost:5000
`;

      await fs.writeFile(passwordFilePath, fileContent, { mode: 0o600 });
      log.info(`📝 Admin password written to: ${passwordFilePath}`);
      log.info(`⚠️  Please delete ${passwordFilePath} after first login!`);
    }

  } catch (error) {
    log.error("❌ Failed to initialize admin user:", error);
    throw error;
  }
}
