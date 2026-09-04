import { Router } from "express";
import { db } from "../../db";
import { mcpServers } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { mcpServerManager } from "../../services/mcp-server-manager";
import {
  DEFAULT_MCP_CATALOG,
  DefaultMcpEntry,
} from "../../services/mcp/default-servers-catalog";
import { syncDefaultCatalog, needsConfig } from "../../services/mcp/catalog-sync";
import { mcpBulkLimiter } from "../../middleware/rate-limit";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// ---------------------------------------------------------------------------
// v2.9.3 Phase 3 — managed-catalog helpers
// ---------------------------------------------------------------------------

function findCatalogEntry(seedKey: string | null | undefined): DefaultMcpEntry | undefined {
  if (!seedKey) return undefined;
  return DEFAULT_MCP_CATALOG.find((entry) => entry.seedKey === seedKey);
}

/**
 * Replace each `requiredSecrets` value with `••••<last4>` so secrets never
 * appear in plaintext in API responses. Non-secret env keys pass through.
 */
function redactSecretEnv(
  env: Record<string, unknown> | null | undefined,
  requiredSecrets: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...((env ?? {}) as Record<string, unknown>) };
  for (const key of requiredSecrets) {
    const value = out[key];
    if (typeof value === "string" && value.length > 0) {
      out[key] = `••••${value.slice(-4)}`;
    }
  }
  return out;
}

// GET /api/v1/mcp-servers - List all MCP servers
router.get("/", async (_req, res) => {
  try {
    const allServers = await db.select().from(mcpServers);
    res.json({ servers: allServers });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list MCP servers", details: error?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// v2.9.3 Phase 3 — catalog endpoints (declared BEFORE /:id routes so Express
// matching doesn't treat "catalog" as an :id parameter)
// ---------------------------------------------------------------------------

// GET /api/v1/mcp-servers/catalog - List the built-in default catalog with
// install + needs-config status per entry.
router.get("/catalog", async (_req, res) => {
  try {
    const installed = await db.select().from(mcpServers);
    const installedBySeedKey = new Map(
      installed.filter((row) => row.seedKey).map((row) => [row.seedKey as string, row]),
    );

    const entries = DEFAULT_MCP_CATALOG.map((entry) => {
      const row = installedBySeedKey.get(entry.seedKey);
      return {
        seedKey: entry.seedKey,
        name: entry.name,
        command: entry.command,
        args: entry.args,
        requiredSecrets: entry.requiredSecrets,
        installed: Boolean(row),
        serverId: row?.id ?? null,
        status: row?.status ?? null,
        needsConfig: row ? needsConfig(row.env as Record<string, unknown> | null, entry) : entry.requiredSecrets.length > 0,
      };
    });

    res.json({ entries });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to load catalog", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/mcp-servers/catalog/sync - Re-insert any missing default rows.
router.post("/catalog/sync", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;
  try {
    const result = await syncDefaultCatalog();
    await logAudit(user.id, "sync_mcp_catalog", "/mcp-servers/catalog/sync", null, true, req);
    res.json(result);
  } catch (error: any) {
    await logAudit(user.id, "sync_mcp_catalog", "/mcp-servers/catalog/sync", null, false, req);
    res.status(500).json({ error: "Catalog sync failed", details: error?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// v3.1.10 — bulk operations (declared before /:id so Express doesn't match
// "bulk" as an :id parameter)
// ---------------------------------------------------------------------------

const MAX_BULK_IDS = 20;

// POST /api/v1/mcp-servers/bulk/start - Start multiple servers
router.post("/bulk/start", ensureRole("admin", "operator"), mcpBulkLimiter, async (req, res) => {
  const user = req.user as any;
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids must be a non-empty array" });
  }
  if (ids.length > MAX_BULK_IDS) {
    return res.status(400).json({ error: `Cannot exceed ${MAX_BULK_IDS} servers per bulk operation` });
  }

  try {
    const existing = await db.select().from(mcpServers).where(inArray(mcpServers.id, ids));
    const existingMap = new Map(existing.map((s) => [s.id, s]));

    const results = await Promise.allSettled(
      ids.map(async (id: string) => {
        if (!existingMap.has(id)) return { id, success: false, error: "Server not found" };
        try {
          const success = await mcpServerManager.startServer(id);
          return { id, success, error: success ? undefined : "Failed to start server" };
        } catch (err: any) {
          return { id, success: false, error: err?.message || "Unknown error" };
        }
      }),
    );

    const settled = results.map((r) => (r.status === "fulfilled" ? r.value : { id: "unknown", success: false, error: "Internal error" }));
    const succeeded = settled.filter((r) => r.success).length;

    // Re-fetch updated rows
    const updatedRows = succeeded > 0
      ? await db.select().from(mcpServers).where(inArray(mcpServers.id, settled.filter((r) => r.success).map((r) => r.id)))
      : [];
    const updatedMap = new Map(updatedRows.map((s) => [s.id, s]));

    const enriched = settled.map((r) => ({ ...r, server: updatedMap.get(r.id) ?? undefined }));

    await logAudit(user.id, "bulk_start_mcp_servers", "/mcp-servers/bulk/start", ids.join(","), succeeded > 0, req);

    res.json({
      results: enriched,
      summary: { total: ids.length, succeeded, failed: ids.length - succeeded },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Bulk start failed", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/mcp-servers/bulk/stop - Stop multiple servers
router.post("/bulk/stop", ensureRole("admin", "operator"), mcpBulkLimiter, async (req, res) => {
  const user = req.user as any;
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids must be a non-empty array" });
  }
  if (ids.length > MAX_BULK_IDS) {
    return res.status(400).json({ error: `Cannot exceed ${MAX_BULK_IDS} servers per bulk operation` });
  }

  try {
    const existing = await db.select().from(mcpServers).where(inArray(mcpServers.id, ids));
    const existingMap = new Map(existing.map((s) => [s.id, s]));

    const results = await Promise.allSettled(
      ids.map(async (id: string) => {
        if (!existingMap.has(id)) return { id, success: false, error: "Server not found" };
        try {
          const success = await mcpServerManager.stopServer(id);
          return { id, success, error: success ? undefined : "Failed to stop server" };
        } catch (err: any) {
          return { id, success: false, error: err?.message || "Unknown error" };
        }
      }),
    );

    const settled = results.map((r) => (r.status === "fulfilled" ? r.value : { id: "unknown", success: false, error: "Internal error" }));
    const succeeded = settled.filter((r) => r.success).length;

    const updatedRows = succeeded > 0
      ? await db.select().from(mcpServers).where(inArray(mcpServers.id, settled.filter((r) => r.success).map((r) => r.id)))
      : [];
    const updatedMap = new Map(updatedRows.map((s) => [s.id, s]));

    const enriched = settled.map((r) => ({ ...r, server: updatedMap.get(r.id) ?? undefined }));

    await logAudit(user.id, "bulk_stop_mcp_servers", "/mcp-servers/bulk/stop", ids.join(","), succeeded > 0, req);

    res.json({
      results: enriched,
      summary: { total: ids.length, succeeded, failed: ids.length - succeeded },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Bulk stop failed", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/mcp-servers/:id - Get server details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "MCP server not found" });
    }

    res.json({ server: result[0] });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get MCP server", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/mcp-servers - Create new MCP server
router.post("/", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;

  try {
    const server = await db
      .insert(mcpServers)
      .values(req.body)
      .returning();

    await logAudit(user.id, "create_mcp_server", "/mcp-servers", server[0].id, true, req);

    res.status(201).json({ server: server[0] });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "create_mcp_server", "/mcp-servers", null, false, req);
    res.status(500).json({ error: "Failed to create MCP server", details: error?.message || "Internal server error" });
  }
});

// PUT /api/v1/mcp-servers/:id - Update server
router.put("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .update(mcpServers)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(mcpServers.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "MCP server not found" });
    }

    await logAudit(user.id, "update_mcp_server", "/mcp-servers", id, true, req);

    res.json({ server: result[0] });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "update_mcp_server", "/mcp-servers", id, false, req);
    res.status(500).json({ error: "Failed to update MCP server", details: error?.message || "Internal server error" });
  }
});

// DELETE /api/v1/mcp-servers/:id - Delete server
// v2.9.3 Phase 3: managed rows (seed_key non-null) require ?force=true so an
// accidental click cannot wipe a built-in default. Force-deletes are audited
// with a distinct action so the trail makes the override explicit.
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;
  const force = String(req.query.force ?? "").toLowerCase() === "true";

  try {
    const existing = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, id))
      .limit(1);
    if (!existing[0]) {
      return res.status(404).json({ error: "MCP server not found" });
    }
    const isManaged = Boolean(existing[0].seedKey);

    if (isManaged && !force) {
      return res.status(409).json({
        error: "Managed default server cannot be deleted without ?force=true",
        seedKey: existing[0].seedKey,
        hint: "Use POST /api/v1/mcp-servers/:id/reset to restore catalog defaults instead.",
      });
    }

    await db.delete(mcpServers).where(eq(mcpServers.id, id));

    const action = isManaged ? "force_delete_mcp_server" : "delete_mcp_server";
    await logAudit(user.id, action, "/mcp-servers", id, true, req);

    res.json({ message: "MCP server deleted successfully" });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "delete_mcp_server", "/mcp-servers", id, false, req);
    res.status(500).json({ error: "Failed to delete MCP server", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/mcp-servers/:id/start - Start server
router.post("/:id/start", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const success = await mcpServerManager.startServer(id);

    if (!success) {
      await logAudit(user.id, "start_mcp_server", "/mcp-servers", id, false, req);
      return res.status(500).json({ error: "Failed to start server", details: "Server failed to start - check server logs" });
    }

    const result = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, id))
      .limit(1);

    await logAudit(user.id, "start_mcp_server", "/mcp-servers", id, true, req);

    res.json({ server: result[0], message: "Server started" });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to start server", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/mcp-servers/:id/stop - Stop server
router.post("/:id/stop", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const success = await mcpServerManager.stopServer(id);

    if (!success) {
      await logAudit(user.id, "stop_mcp_server", "/mcp-servers", id, false, req);
      return res.status(500).json({ error: "Failed to stop server", details: "Server failed to stop - check server logs" });
    }

    const result = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, id))
      .limit(1);

    await logAudit(user.id, "stop_mcp_server", "/mcp-servers", id, true, req);

    res.json({ server: result[0], message: "Server stopped" });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to stop server", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/mcp-servers/:id/restart - Restart server
router.post("/:id/restart", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const success = await mcpServerManager.restartServer(id);

    if (!success) {
      await logAudit(user.id, "restart_mcp_server", "/mcp-servers", id, false, req);
      return res.status(500).json({ error: "Failed to restart server", details: "Server failed to restart - check server logs" });
    }

    const result = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, id))
      .limit(1);

    await logAudit(user.id, "restart_mcp_server", "/mcp-servers", id, true, req);

    res.json({ server: result[0], message: "Server restarted" });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to restart server", details: error?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// v2.9.3 Phase 3 — managed-row maintenance
// ---------------------------------------------------------------------------

// POST /api/v1/mcp-servers/:id/reset - Reset a managed row to catalog defaults.
// Restores command, args, and env *keys* from the catalog. Existing secret
// values are preserved unless ?wipeSecrets=true is passed. Rejects rows
// without a seedKey (user-created rows have no catalog to reset to).
router.post("/:id/reset", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;
  const wipeSecrets = String(req.query.wipeSecrets ?? "").toLowerCase() === "true";

  try {
    const existing = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, id))
      .limit(1);
    if (!existing[0]) {
      return res.status(404).json({ error: "MCP server not found" });
    }

    const entry = findCatalogEntry(existing[0].seedKey);
    if (!entry) {
      return res.status(400).json({
        error: "Server is not a managed default (no seedKey or unknown catalog entry)",
      });
    }

    // Build the reset env: catalog keys, with existing secret values preserved
    // unless the caller explicitly asked to wipe them.
    const existingEnv = (existing[0].env ?? {}) as Record<string, unknown>;
    const resetEnv: Record<string, string> = {};
    for (const [key, defaultValue] of Object.entries(entry.env)) {
      const isSecret = entry.requiredSecrets.includes(key);
      const preserved = !wipeSecrets && isSecret && typeof existingEnv[key] === "string"
        ? (existingEnv[key] as string)
        : defaultValue;
      resetEnv[key] = preserved;
    }

    const result = await db
      .update(mcpServers)
      .set({
        name: entry.name,
        command: entry.command,
        args: entry.args,
        env: resetEnv,
        updatedAt: new Date(),
      })
      .where(eq(mcpServers.id, id))
      .returning();

    await logAudit(user.id, "reset_mcp_server", "/mcp-servers", id, true, req);

    const redacted = {
      ...result[0],
      env: redactSecretEnv(result[0].env as Record<string, unknown>, entry.requiredSecrets),
    };
    res.json({ server: redacted, wipedSecrets: wipeSecrets });
  } catch (error: any) {
    await logAudit(user.id, "reset_mcp_server", "/mcp-servers", id, false, req);
    res.status(500).json({ error: "Failed to reset server", details: error?.message || "Internal server error" });
  }
});

// PATCH /api/v1/mcp-servers/:id/secrets - Merge secret env values into a row.
// Body: { env: Record<string, string> } — only the keys present in the body
// are written; other env keys on the row are preserved. Response env is
// redacted (last-4 only) for any required-secret key on a managed row.
router.patch("/:id/secrets", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;
  const incoming = req.body?.env;

  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return res.status(400).json({ error: "Request body must include an env object" });
  }

  try {
    const existing = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, id))
      .limit(1);
    if (!existing[0]) {
      return res.status(404).json({ error: "MCP server not found" });
    }

    // Coerce values to string; reject anything else loudly so the caller
    // doesn't accidentally store JSON blobs in env (env is always string→string).
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(incoming as Record<string, unknown>)) {
      if (typeof value !== "string") {
        return res.status(400).json({
          error: `env.${key} must be a string`,
        });
      }
      sanitized[key] = value;
    }

    const mergedEnv = {
      ...((existing[0].env ?? {}) as Record<string, unknown>),
      ...sanitized,
    };

    const result = await db
      .update(mcpServers)
      .set({ env: mergedEnv, updatedAt: new Date() })
      .where(eq(mcpServers.id, id))
      .returning();

    await logAudit(user.id, "patch_mcp_secrets", "/mcp-servers", id, true, req);

    const entry = findCatalogEntry(result[0].seedKey);
    const redacted = {
      ...result[0],
      env: redactSecretEnv(
        result[0].env as Record<string, unknown>,
        entry?.requiredSecrets ?? [],
      ),
    };
    res.json({ server: redacted });
  } catch (error: any) {
    await logAudit(user.id, "patch_mcp_secrets", "/mcp-servers", id, false, req);
    res.status(500).json({ error: "Failed to update secrets", details: error?.message || "Internal server error" });
  }
});

export default router;
