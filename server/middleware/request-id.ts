import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers["x-request-id"] as string) || randomUUID();
  req.id = id;
  req.log = logger.child({ requestId: id });
  res.setHeader("X-Request-ID", id);
  next();
}
