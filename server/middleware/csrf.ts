import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// CSRF token storage (in production, use Redis)
const csrfTokens = new Map<string, string>();

// Generate CSRF token
export function generateCsrfToken(req: Request): string {
  const token = crypto.randomBytes(32).toString("hex");
  const sessionId = (req.session as any)?.id || req.sessionID;
  
  csrfTokens.set(sessionId, token);
  
  // Clean up old tokens (basic cleanup, in production use Redis with TTL)
  if (csrfTokens.size > 1000) {
    const firstKey = csrfTokens.keys().next().value;
    csrfTokens.delete(firstKey);
  }
  
  return token;
}

// Validate CSRF token
export function validateCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const sessionId = (req.session as any)?.id || req.sessionID;
  const providedToken = req.headers["x-csrf-token"] as string;
  const storedToken = csrfTokens.get(sessionId);

  if (!providedToken || !storedToken || providedToken !== storedToken) {
    return res.status(403).json({ 
      error: "CSRF token validation failed",
      message: "Invalid or missing CSRF token" 
    });
  }

  next();
}

// Middleware to attach CSRF token to response
export function attachCsrfToken(req: Request, res: Response, next: NextFunction) {
  const token = generateCsrfToken(req);
  res.locals.csrfToken = token;
  next();
}
