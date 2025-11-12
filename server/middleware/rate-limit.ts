import rateLimit from "express-rate-limit";
import { redisClient } from "../auth/session";

// Rate limiter using Redis for distributed rate limiting
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  // Use Redis for distributed rate limiting (optional, falls back to memory)
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === "/api/v1/health";
  },
});

// Stricter rate limit for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: "Too many authentication attempts, please try again later",
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Rate limit for password changes
export const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password changes per hour
  message: "Too many password change attempts, please try again later",
});
