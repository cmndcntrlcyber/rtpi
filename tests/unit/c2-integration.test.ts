import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * C2 Framework Integration Tests
 *
 * Verifies auth middleware, audit logging, and service patterns
 * across Empire, Sliver, and Rust-Nexus components.
 */

// ============================================================================
// A. Empire Auth Guard Assertions
// ============================================================================

describe("Empire API Auth Guards", () => {
  const src = readFileSync(
    resolve(__dirname, "../../server/api/v1/empire.ts"),
    "utf8"
  );

  it("applies ensureAuthenticated to all routes", () => {
    expect(src).toMatch(/router\.use\(ensureAuthenticated\)/);
  });

  it("imports ensureAuthenticated and ensureRole", () => {
    expect(src).toMatch(
      /import\s*{[^}]*ensureAuthenticated[^}]*ensureRole[^}]*}\s*from/
    );
  });

  it("applies ensureRole to server creation", () => {
    const idx = src.indexOf('router.post("/servers"');
    expect(idx).toBeGreaterThan(-1);
    const slice = src.slice(idx, idx + 200);
    expect(slice).toMatch(/ensureRole\(\s*"admin"\s*\)/);
  });

  it("applies ensureRole to server deletion", () => {
    const idx = src.indexOf('router.delete("/servers/:id"');
    expect(idx).toBeGreaterThan(-1);
    const slice = src.slice(idx, idx + 200);
    expect(slice).toMatch(/ensureRole\(\s*"admin"\s*\)/);
  });

  it("applies ensureRole to task execution", () => {
    const idx = src.indexOf(
      'router.post("/servers/:serverId/agents/:agentName/tasks"'
    );
    expect(idx).toBeGreaterThan(-1);
    const slice = src.slice(idx, idx + 200);
    expect(slice).toMatch(/ensureRole/);
  });

  it("applies ensureRole to agent kill", () => {
    const idx = src.indexOf(
      'router.delete("/servers/:serverId/agents/:agentName"'
    );
    expect(idx).toBeGreaterThan(-1);
    const slice = src.slice(idx, idx + 200);
    expect(slice).toMatch(/ensureRole/);
  });

  it("applies ensureRole to credential access", () => {
    const idx = src.indexOf('router.get("/servers/:serverId/credentials"');
    expect(idx).toBeGreaterThan(-1);
    const slice = src.slice(idx, idx + 200);
    expect(slice).toMatch(/ensureRole/);
  });

  it("applies ensureRole to credential sync", () => {
    const idx = src.indexOf(
      'router.post("/servers/:serverId/credentials/sync"'
    );
    expect(idx).toBeGreaterThan(-1);
    const slice = src.slice(idx, idx + 200);
    expect(slice).toMatch(/ensureRole/);
  });

  it("applies ensureRole to listener creation", () => {
    const idx = src.indexOf(
      'router.post("/servers/:serverId/listeners"'
    );
    expect(idx).toBeGreaterThan(-1);
    const slice = src.slice(idx, idx + 200);
    expect(slice).toMatch(/ensureRole/);
  });

  it("applies ensureRole to module execution", () => {
    const idx = src.indexOf(
      'router.post("/servers/:serverId/agents/:agentName/modules/:moduleName"'
    );
    expect(idx).toBeGreaterThan(-1);
    const slice = src.slice(idx, idx + 200);
    expect(slice).toMatch(/ensureRole/);
  });

  it("includes audit logging for mutating operations", () => {
    expect(src).toMatch(/logAudit.*empire_create_server/);
    expect(src).toMatch(/logAudit.*empire_delete_server/);
    expect(src).toMatch(/logAudit.*empire_execute_task/);
    expect(src).toMatch(/logAudit.*empire_kill_agent/);
    expect(src).toMatch(/logAudit.*empire_sync_credentials/);
  });
});

// ============================================================================
// B. Empire 401 Route Tests (against live server, skipped if unavailable)
// ============================================================================

const API_BASE = process.env.TEST_API_URL || "http://localhost:3001";

describe("Empire API 401 Enforcement", () => {
  const canReachServer = async () => {
    try {
      await fetch(`${API_BASE}/api/v1`, { signal: AbortSignal.timeout(2000) });
      return true;
    } catch {
      return false;
    }
  };

  it("returns 401 for unauthenticated GET /empire/servers", async () => {
    if (!(await canReachServer())) return;
    const res = await fetch(`${API_BASE}/api/v1/empire/servers`);
    expect(res.status).toBe(401);
  });

  it("returns 401 for unauthenticated POST /empire/servers", async () => {
    if (!(await canReachServer())) return;
    const res = await fetch(`${API_BASE}/api/v1/empire/servers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for unauthenticated task execution", async () => {
    if (!(await canReachServer())) return;
    const res = await fetch(
      `${API_BASE}/api/v1/empire/servers/fake/agents/fake/tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "whoami" }),
      }
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for unauthenticated GET /sliver/status", async () => {
    if (!(await canReachServer())) return;
    const res = await fetch(`${API_BASE}/api/v1/sliver/status`);
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// C. Rust-Nexus Audit Logging Assertions
// ============================================================================

describe("Rust-Nexus Audit Logging", () => {
  const src = readFileSync(
    resolve(__dirname, "../../server/services/rust-nexus-controller.ts"),
    "utf8"
  );

  it("imports logToolAudit", () => {
    expect(src).toMatch(/import\s*{[^}]*logToolAudit[^}]*}\s*from/);
  });

  it("logs implant registration events", () => {
    expect(src).toMatch(/logToolAudit.*rust_nexus_implant_register/);
  });

  it("logs task assignment events", () => {
    expect(src).toMatch(/logToolAudit.*rust_nexus_task_assign/);
  });

  it("logs task completion events", () => {
    expect(src).toMatch(/logToolAudit.*rust_nexus_task_complete/);
  });

  it("logs task failure events", () => {
    expect(src).toMatch(/logToolAudit.*rust_nexus_task_fail/);
  });

  it("logs implant disconnection events", () => {
    expect(src).toMatch(/logToolAudit.*rust_nexus_implant_disconnect/);
  });

  it("logs implant termination events", () => {
    expect(src).toMatch(/logToolAudit.*rust_nexus_implant_terminate/);
  });

  it("logs implant connection events", () => {
    expect(src).toMatch(/logToolAudit.*rust_nexus_implant_connect/);
  });

  it("logs registration failures", () => {
    const matches = src.match(/logToolAudit.*rust_nexus_implant_register/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// D. Sliver Service Assertions
// ============================================================================

describe("Sliver Executor Service", () => {
  const src = readFileSync(
    resolve(__dirname, "../../server/services/sliver-executor.ts"),
    "utf8"
  );

  it("exports a singleton instance", () => {
    expect(src).toMatch(/export const sliverExecutor/);
  });

  it("uses dockerExecutor for container interaction", () => {
    expect(src).toMatch(/dockerExecutor\.exec/);
  });

  it("targets the correct container", () => {
    expect(src).toMatch(/rtpi-sliver-agent/);
  });

  it("imports logToolAudit for audit logging", () => {
    expect(src).toMatch(/import\s*{[^}]*logToolAudit[^}]*}\s*from/);
  });

  it("provides key C2 operations", () => {
    expect(src).toMatch(/async checkConnection/);
    expect(src).toMatch(/async listSessions/);
    expect(src).toMatch(/async executeCommand/);
    expect(src).toMatch(/async killSession/);
    expect(src).toMatch(/async startListener/);
    expect(src).toMatch(/async stopListener/);
    expect(src).toMatch(/async generateImplant/);
  });
});

describe("Sliver API Routes", () => {
  const src = readFileSync(
    resolve(__dirname, "../../server/api/v1/sliver.ts"),
    "utf8"
  );

  it("applies ensureAuthenticated to all routes", () => {
    expect(src).toMatch(/router\.use\(ensureAuthenticated\)/);
  });

  it("applies ensureRole to command execution", () => {
    const idx = src.indexOf("execute");
    expect(idx).toBeGreaterThan(-1);
    const slice = src.slice(Math.max(0, idx - 200), idx + 100);
    expect(slice).toMatch(/ensureRole.*"admin".*"operator"/);
  });

  it("applies ensureRole to session kill", () => {
    const idx = src.indexOf('router.delete("/sessions/:sessionId"');
    expect(idx).toBeGreaterThan(-1);
    const slice = src.slice(idx, idx + 200);
    expect(slice).toMatch(/ensureRole/);
  });

  it("applies ensureRole to implant generation", () => {
    const idx = src.indexOf('router.post("/implants/generate"');
    expect(idx).toBeGreaterThan(-1);
    const slice = src.slice(idx, idx + 200);
    expect(slice).toMatch(/ensureRole/);
  });

  it("applies ensureRole to listener management", () => {
    const idx = src.indexOf('router.post("/listeners"');
    expect(idx).toBeGreaterThan(-1);
    const slice = src.slice(idx, idx + 200);
    expect(slice).toMatch(/ensureRole/);
  });
});

// ============================================================================
// E. Empire Task Polling
// ============================================================================

describe("Empire Task Polling", () => {
  const src = readFileSync(
    resolve(__dirname, "../../server/services/empire-executor.ts"),
    "utf8"
  );

  it("has pollTaskResult method", () => {
    expect(src).toMatch(/async pollTaskResult/);
  });

  it("has cancelPoll method", () => {
    expect(src).toMatch(/cancelPoll\(taskId/);
  });

  it("has getActivePolls method", () => {
    expect(src).toMatch(/getActivePolls\(\)/);
  });

  it("tracks active polls in a Map", () => {
    expect(src).toMatch(/private activePolls\s*=\s*new Map/);
  });

  it("exposes polling via API routes", () => {
    const routeSrc = readFileSync(
      resolve(__dirname, "../../server/api/v1/empire.ts"),
      "utf8"
    );
    expect(routeSrc).toMatch(/tasks\/:taskId\/poll/);
  });
});

// ============================================================================
// F. Schema Assertions
// ============================================================================

describe("Sliver Schema Tables", () => {
  const src = readFileSync(
    resolve(__dirname, "../../shared/schema.ts"),
    "utf8"
  );

  it("defines sliverSessions table", () => {
    expect(src).toMatch(/export const sliverSessions\s*=\s*pgTable/);
  });

  it("defines sliverTasks table", () => {
    expect(src).toMatch(/export const sliverTasks\s*=\s*pgTable/);
  });

  it("defines sliverSessionStatusEnum", () => {
    expect(src).toMatch(/export const sliverSessionStatusEnum/);
  });
});
