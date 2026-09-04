import dotenv from "dotenv";
dotenv.config();

import { db } from "../../db";
import { users } from "../../../shared/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { createLogger } from "../../lib/logger";
const log = createLogger("unlock-admin");

async function unlockAdmin() {
  try {
    const username = process.argv[2] || process.env.DEFAULT_ADMIN_USERNAME || "admin";

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        failedLoginAttempts: users.failedLoginAttempts,
        lockedUntil: users.lockedUntil,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      log.error(`User '${username}' not found`);
      process.exit(1);
    }

    const isLocked = user.lockedUntil && user.lockedUntil > new Date();

    if (!isLocked && user.failedLoginAttempts === 0) {
      log.info(`Account '${username}' is already unlocked (0 failed attempts, no lock)`);
      process.exit(0);
    }

    log.info(`Account '${username}' status:`);
    log.info(`  Failed attempts: ${user.failedLoginAttempts}`);
    log.info(`  Locked until:    ${user.lockedUntil ?? "not locked"}`);
    log.info(`  Active:          ${user.isActive}`);

    await db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    log.info(`Unlocked account '${username}' — failed attempts reset to 0, lock cleared`);
    process.exit(0);
  } catch (error) {
    log.error("Failed to unlock account:", error);
    process.exit(1);
  }
}

unlockAdmin();
