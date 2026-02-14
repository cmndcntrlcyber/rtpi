import session from "express-session";
import RedisStore from "connect-redis";
import { createClient } from "redis";

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => console.error("Redis Client Error:", err));
redisClient.on("connect", () => console.log("✅ Redis connected for sessions"));

// Connect to Redis asynchronously (non-blocking)
redisClient.connect().catch((err) => {
  console.error("Failed to connect to Redis:", err);
  process.exit(1);
});

// Configure session middleware
export const sessionMiddleware = session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET || "change-this-secret-in-production",
  resave: false,
  saveUninitialized: false,
  name: "rtpi.sid",
  cookie: {
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    sameSite: "lax",
  },
});

export { redisClient };
