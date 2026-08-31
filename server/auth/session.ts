import session from "express-session";
import RedisStore from "connect-redis";
import { createClient } from "redis";
import { createLogger } from "../lib/logger";

const log = createLogger("session");

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6381",
});

redisClient.on("error", (err) => log.error({ err }, "Redis client error"));
redisClient.on("connect", () => log.info("Redis connected for sessions"));

// Deferred connection — called from initializeServer() with retry logic.
// RedisStore handles reconnection internally; the client reference is stable.
export async function connectRedis(): Promise<void> {
  const { retryWithBackoff } = await import("../lib/retry");
  await retryWithBackoff(
    () => redisClient.connect(),
    {
      maxRetries: 10,
      initialDelayMs: 1000,
      maxDelayMs: 30_000,
      label: "redis",
    },
  );
}

// Guard against insecure default in production
const DEFAULT_SECRET = "change-this-secret-in-production";
const sessionSecret = process.env.SESSION_SECRET || DEFAULT_SECRET;

if (process.env.NODE_ENV === "production" && sessionSecret === DEFAULT_SECRET) {
  throw new Error(
    "FATAL: SESSION_SECRET must be set to a secure random value in production. " +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
  );
}

// Configure session middleware
export const sessionMiddleware = session({
  store: new RedisStore({ client: redisClient }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: "rtpi.sid",
  cookie: {
    secure: process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    sameSite: "lax",
  },
});

export { redisClient, sessionSecret };
