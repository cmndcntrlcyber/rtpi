import { Router } from "express";
import { db } from "../../db";
import { vulnerabilities } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/vulnerabilities - List all vulnerabilities
router.get("/", async (req, res) => {
  try {
    const allVulns = await db.select().from(vulnerabilities);
    res.json({ vulnerabilities: allVulns });
  } catch (error) {
    console.error("List vulnerabilities error:", error);
    res.status(500).json({ error: "Failed to list vulnerabilities" });
  }
});

// GET /api/v1/vulnerabilities/:id - Get vulnerability details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Vulnerability not found" });
    }

    res.json({ vulnerability: result[0] });
  } catch (error) {
    console.error("Get vulnerability error:", error);
    res.status(500).json({ error: "Failed to get vulnerability" });
  }
});

// POST /api/v1/vulnerabilities - Create new vulnerability
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const vuln = await db
      .insert(vulnerabilities)
      .values(req.body)
      .returning();

    await logAudit(user.id, "create_vulnerability", "/vulnerabilities", vuln[0].id, true, req);

    res.status(201).json({ vulnerability: vuln[0] });
  } catch (error) {
    console.error("Create vulnerability error:", error);
    await logAudit(user.id, "create_vulnerability", "/vulnerabilities", null, false, req);
    res.status(500).json({ error: "Failed to create vulnerability" });
  }
});

// PUT /api/v1/vulnerabilities/:id - Update vulnerability
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .update(vulnerabilities)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(vulnerabilities.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Vulnerability not found" });
    }

    await logAudit(user.id, "update_vulnerability", "/vulnerabilities", id, true, req);

    res.json({ vulnerability: result[0] });
  } catch (error) {
    console.error("Update vulnerability error:", error);
    await logAudit(user.id, "update_vulnerability", "/vulnerabilities", id, false, req);
    res.status(500).json({ error: "Failed to update vulnerability" });
  }
});

// DELETE /api/v1/vulnerabilities/:id - Delete vulnerability
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    await db.delete(vulnerabilities).where(eq(vulnerabilities.id, id));

    await logAudit(user.id, "delete_vulnerability", "/vulnerabilities", id, true, req);

    res.json({ message: "Vulnerability deleted successfully" });
  } catch (error) {
    console.error("Delete vulnerability error:", error);
    await logAudit(user.id, "delete_vulnerability", "/vulnerabilities", id, false, req);
    res.status(500).json({ error: "Failed to delete vulnerability" });
  }
});

export default router;
