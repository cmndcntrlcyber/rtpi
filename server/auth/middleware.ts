import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { auditLogs } from "@shared/schema";

// Ensure user is authenticated
export function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
}

// Ensure user has one of the specified roles
export function ensureRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = req.user as any;
    
    if (!roles.includes(user.role)) {
      return res.status(403).json({ 
        error: "Forbidden", 
        message: "Insufficient permissions" 
      });
    }

    next();
  };
}

// Log audit event
export async function logAudit(
  userId: string,
  action: string,
  resource: string,
  resourceId: string | null,
  success: boolean,
  req: Request
) {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      resource,
      resourceId,
      success,
      ipAddress: req.ip || req.socket.remoteAddress || null,
      userAgent: req.headers["user-agent"] || null,
      details: {
        method: req.method,
        path: req.path,
        query: req.query,
      },
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}
