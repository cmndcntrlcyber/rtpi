import passport from "passport";
import { Strategy as CustomStrategy } from "passport-custom";
import crypto from "crypto";
import { db } from "../../db";
import { users, apiKeys } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { redisClient } from "../session";
import { createLogger } from "../../lib/logger";

const log = createLogger("apikey-auth");

// API Key Authentication Strategy
passport.use(
  "api-key",
  new CustomStrategy(async (req, done) => {
    try {
      const apiKey = req.headers["x-api-key"] as string;

      if (!apiKey) {
        return done(null, false);
      }

      // Hash the provided API key
      const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

      // Find API key in database
      const result = await db
        .select({
          apiKey: apiKeys,
          user: users,
        })
        .from(apiKeys)
        .innerJoin(users, eq(apiKeys.userId, users.id))
        .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
        .limit(1);

      const record = result[0];

      if (!record) {
        return done(null, false);
      }

      // Check if API key has expired
      if (record.apiKey.expiresAt && record.apiKey.expiresAt < new Date()) {
        return done(null, false);
      }

      // Check if user is active
      if (!record.user.isActive) {
        return done(null, false);
      }

      // Per-key rate limiting via Redis sliding window
      if (record.apiKey.rateLimit) {
        try {
          const rlKey = `apikey-rl:${record.apiKey.id}`;
          const count = await redisClient.incr(rlKey);
          if (count === 1) {
            await redisClient.expire(rlKey, 60);
          }
          if (count > record.apiKey.rateLimit) {
            return done(null, false);
          }
        } catch (rlError) {
          log.warn({ err: rlError }, "Rate limit check failed, allowing request");
        }
      }

      // Update last used timestamp
      await db
        .update(apiKeys)
        .set({ lastUsed: new Date() })
        .where(eq(apiKeys.id, record.apiKey.id));

      // Return user object
      return done(null, record.user);
    } catch (error) {
      return done(error as Error);
    }
  })
);

export default passport;
