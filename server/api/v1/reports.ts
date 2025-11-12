import { Router } from "express";
import { db } from "../../db";
import { reports, reportTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/reports - List all reports
router.get("/", async (req, res) => {
  try {
    const allReports = await db.select().from(reports);
    res.json({ reports: allReports });
  } catch (error) {
    console.error("List reports error:", error);
    res.status(500).json({ error: "Failed to list reports" });
  }
});

// GET /api/v1/reports/:id - Get report details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select()
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json({ report: result[0] });
  } catch (error) {
    console.error("Get report error:", error);
    res.status(500).json({ error: "Failed to get report" });
  }
});

// POST /api/v1/reports - Generate new report
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const report = await db
      .insert(reports)
      .values({
        ...req.body,
        generatedBy: user.id,
        status: req.body.status || "draft",
      })
      .returning();

    await logAudit(user.id, "generate_report", "/reports", report[0].id, true, req);

    res.status(201).json({ report: report[0] });
  } catch (error) {
    console.error("Generate report error:", error);
    await logAudit(user.id, "generate_report", "/reports", null, false, req);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

// PUT /api/v1/reports/:id - Update report
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .update(reports)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    await logAudit(user.id, "update_report", "/reports", id, true, req);

    res.json({ report: result[0] });
  } catch (error) {
    console.error("Update report error:", error);
    await logAudit(user.id, "update_report", "/reports", id, false, req);
    res.status(500).json({ error: "Failed to update report" });
  }
});

// DELETE /api/v1/reports/:id - Delete report
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    await db.delete(reports).where(eq(reports.id, id));

    await logAudit(user.id, "delete_report", "/reports", id, true, req);

    res.json({ message: "Report deleted successfully" });
  } catch (error) {
    console.error("Delete report error:", error);
    await logAudit(user.id, "delete_report", "/reports", id, false, req);
    res.status(500).json({ error: "Failed to delete report" });
  }
});

// GET /api/v1/reports/templates - List templates
router.get("/templates/list", async (req, res) => {
  try {
    const templates = await db
      .select()
      .from(reportTemplates)
      .where(eq(reportTemplates.isActive, true));
    
    res.json({ templates });
  } catch (error) {
    console.error("List templates error:", error);
    res.status(500).json({ error: "Failed to list templates" });
  }
});

// POST /api/v1/reports/templates - Create template
router.post("/templates", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;

  try {
    const template = await db
      .insert(reportTemplates)
      .values({
        ...req.body,
        createdBy: user.id,
      })
      .returning();

    await logAudit(user.id, "create_template", "/reports/templates", template[0].id, true, req);

    res.status(201).json({ template: template[0] });
  } catch (error) {
    console.error("Create template error:", error);
    await logAudit(user.id, "create_template", "/reports/templates", null, false, req);
    res.status(500).json({ error: "Failed to create template" });
  }
});

// DELETE /api/v1/reports/templates/:id - Delete template
router.delete("/templates/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    await db
      .update(reportTemplates)
      .set({ isActive: false })
      .where(eq(reportTemplates.id, id));

    await logAudit(user.id, "delete_template", "/reports/templates", id, true, req);

    res.json({ message: "Template deleted successfully" });
  } catch (error) {
    console.error("Delete template error:", error);
    await logAudit(user.id, "delete_template", "/reports/templates", id, false, req);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

export default router;
