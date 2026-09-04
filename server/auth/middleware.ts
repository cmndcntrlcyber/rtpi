import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { auditLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "../lib/logger";
import { auditEventsTotal } from "../lib/metrics";

const log = createLogger("auth");

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

// Ensure authenticated user owns the resource (admins bypass)
export function ensureResourceOwnership(
  table: any,
  ownerField: any,
  idParam: string = "id"
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = req.user as any;
    if (user.role === "admin") {
      return next();
    }

    const resourceId = req.params[idParam];

    try {
      const result = await db
        .select({ ownerId: ownerField })
        .from(table)
        .where(eq(table.id, resourceId))
        .limit(1);

      if (!result || result.length === 0) {
        return res.status(404).json({ error: "Resource not found" });
      }

      if (result[0].ownerId !== user.id) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You do not own this resource",
        });
      }

      next();
    } catch (error) {
      log.error({ err: error }, "Resource ownership check failed");
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

// Log audit event (from HTTP request context)
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
    auditEventsTotal.inc({ action, success: String(success) });
  } catch (error) {
    log.error({ err: error }, "Failed to log audit event");
  }
}

// Log audit event from service layer (no Express Request required)
export async function logToolAudit(
  userId: string | null,
  action: string,
  resource: string,
  resourceId: string | null,
  success: boolean,
  details: Record<string, any>
) {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      resource,
      resourceId,
      success,
      details,
    });
    auditEventsTotal.inc({ action, success: String(success) });
  } catch (error) {
    log.error({ err: error, action, resource }, "Failed to log tool audit event");
  }
}
