import os from "os";
import { client } from "../db";
import { redisClient } from "../auth/session";
import { healthStatus } from "./metrics";
import { createLogger } from "./logger";

const log = createLogger("health");

export interface ComponentCheck {
  ok: boolean;
  latencyMs: number;
}

export interface SystemMetrics {
  memoryUsageMB: number;
  memoryTotalMB: number;
  uptimeSeconds: number;
}

export interface HealthResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  checks: {
    database: ComponentCheck;
    redis: ComponentCheck;
    system: SystemMetrics;
  };
}

export async function checkDB(): Promise<ComponentCheck> {
  const start = performance.now();
  try {
    await client`SELECT 1`;
    const latencyMs = Math.round(performance.now() - start);
    healthStatus.set({ component: "database" }, 1);
    return { ok: true, latencyMs };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    healthStatus.set({ component: "database" }, 0);
    log.error({ err, latencyMs }, "Database health check failed");
    return { ok: false, latencyMs };
  }
}

export async function checkRedis(): Promise<ComponentCheck> {
  const start = performance.now();
  try {
    await redisClient.ping();
    const latencyMs = Math.round(performance.now() - start);
    healthStatus.set({ component: "redis" }, 1);
    return { ok: true, latencyMs };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    healthStatus.set({ component: "redis" }, 0);
    log.error({ err, latencyMs }, "Redis health check failed");
    return { ok: false, latencyMs };
  }
}

export function getSystemMetrics(): SystemMetrics {
  const mem = process.memoryUsage();
  return {
    memoryUsageMB: Math.round(mem.rss / 1024 / 1024),
    memoryTotalMB: Math.round(os.totalmem() / 1024 / 1024),
    uptimeSeconds: Math.round(process.uptime()),
  };
}

export async function fullHealthCheck(): Promise<HealthResult> {
  const [db, redis] = await Promise.all([checkDB(), checkRedis()]);
  const system = getSystemMetrics();

  let status: HealthResult["status"];
  if (db.ok && redis.ok) {
    status = "healthy";
    healthStatus.set({ component: "overall" }, 1);
  } else if (!db.ok && !redis.ok) {
    status = "unhealthy";
    healthStatus.set({ component: "overall" }, 0);
  } else {
    status = "degraded";
    healthStatus.set({ component: "overall" }, 0.5);
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: system.uptimeSeconds,
    checks: { database: db, redis, system },
  };
}
