import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { redisClient } from "../auth/session";
import { secureCompare } from "../utils/encryption";

const CSRF_PREFIX = "csrf:";
const CSRF_TTL_SECONDS = 3600;

export async function generateCsrfToken(req: Request): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const sessionId = (req.session as any)?.id || req.sessionID;

  await redisClient.set(`${CSRF_PREFIX}${sessionId}`, token, {
    EX: CSRF_TTL_SECONDS,
  });

  return token;
}

export async function validateCsrfToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  try {
    const sessionId = (req.session as any)?.id || req.sessionID;
    const providedToken = req.headers["x-csrf-token"] as string;
    const storedToken = await redisClient.get(`${CSRF_PREFIX}${sessionId}`);

    if (
      !providedToken ||
      !storedToken ||
      !secureCompare(providedToken, storedToken)
    ) {
      return res.status(403).json({
        error: "CSRF token validation failed",
        message: "Invalid or missing CSRF token",
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}

export async function attachCsrfToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = await generateCsrfToken(req);
    res.locals.csrfToken = token;
    next();
  } catch (err) {
    next(err);
  }
}
