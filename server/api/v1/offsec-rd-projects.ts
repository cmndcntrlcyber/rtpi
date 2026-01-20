import { Router } from "express";
import { db } from "../../db";
import { researchProjects, agents, users } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { z } from "zod";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// Validation schema for research project data
const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  type: z.enum([
    "tool_testing",
    "vulnerability_research",
    "technique_development",
    "knowledge_curation",
    "poc_development"
  ]),
  status: z.enum(["draft", "active", "completed", "archived", "cancelled"]).optional(),
  leadAgentId: z.string().uuid().optional(),
  assignedAgents: z.array(z.string().uuid()).optional(),
  objectives: z.string().optional(),
  successCriteria: z.string().optional(),
  findings: z.any().optional(),
  artifacts: z.array(z.object({
    type: z.enum(["code", "report", "poc", "binary", "documentation"]),
    name: z.string(),
    path: z.string(),
    createdAt: z.string(),
  })).optional(),
});

// GET /api/v1/offsec-rd/projects - List all research projects
router.get("/", async (_req, res) => {
  try {
    const projects = await db
      .select({
        id: researchProjects.id,
        name: researchProjects.name,
        description: researchProjects.description,
        type: researchProjects.type,
        status: researchProjects.status,
        leadAgentId: researchProjects.leadAgentId,
        leadAgentName: agents.name,
        assignedAgents: researchProjects.assignedAgents,
        objectives: researchProjects.objectives,
        successCriteria: researchProjects.successCriteria,
        findings: researchProjects.findings,
        artifacts: researchProjects.artifacts,
        createdBy: researchProjects.createdBy,
        createdByUsername: users.username,
        createdAt: researchProjects.createdAt,
        updatedAt: researchProjects.updatedAt,
        completedAt: researchProjects.completedAt,
      })
      .from(researchProjects)
      .leftJoin(agents, eq(researchProjects.leadAgentId, agents.id))
      .leftJoin(users, eq(researchProjects.createdBy, users.id))
      .orderBy(desc(researchProjects.createdAt));

    res.json({ projects });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to retrieve research projects",
      details: error.message
    });
  }
});

// GET /api/v1/offsec-rd/projects/:id - Get project details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select({
        id: researchProjects.id,
        name: researchProjects.name,
        description: researchProjects.description,
        type: researchProjects.type,
        status: researchProjects.status,
        leadAgentId: researchProjects.leadAgentId,
        leadAgentName: agents.name,
        assignedAgents: researchProjects.assignedAgents,
        objectives: researchProjects.objectives,
        successCriteria: researchProjects.successCriteria,
        findings: researchProjects.findings,
        artifacts: researchProjects.artifacts,
        createdBy: researchProjects.createdBy,
        createdByUsername: users.username,
        createdAt: researchProjects.createdAt,
        updatedAt: researchProjects.updatedAt,
        completedAt: researchProjects.completedAt,
      })
      .from(researchProjects)
      .leftJoin(agents, eq(researchProjects.leadAgentId, agents.id))
      .leftJoin(users, eq(researchProjects.createdBy, users.id))
      .where(eq(researchProjects.id, id))
      .limit(1);

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Research project not found" });
    }

    res.json({ project: result[0] });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to retrieve research project",
      details: error.message
    });
  }
});

// POST /api/v1/offsec-rd/projects - Create new research project
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const validatedData = projectSchema.parse(req.body);

    const [newProject] = await db
      .insert(researchProjects)
      .values({
        name: validatedData.name,
        description: validatedData.description,
        type: validatedData.type,
        status: validatedData.status || "active",
        leadAgentId: validatedData.leadAgentId,
        assignedAgents: validatedData.assignedAgents || [],
        objectives: validatedData.objectives,
        successCriteria: validatedData.successCriteria,
        findings: validatedData.findings || {},
        artifacts: validatedData.artifacts || [],
        createdBy: user.id,
      })
      .returning();

    // Audit log
    await logAudit(
      user.id,
      "offsec_rd_project_create",
      "/offsec-rd/projects",
      newProject.id,
      true,
      req
    );

    res.status(201).json({ project: newProject });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors
      });
    }
    res.status(500).json({
      error: "Failed to create research project",
      details: error.message
    });
  }
});

// PUT /api/v1/offsec-rd/projects/:id - Update research project
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const validatedData = projectSchema.partial().parse(req.body);

    // Check if project exists
    const existing = await db
      .select()
      .from(researchProjects)
      .where(eq(researchProjects.id, id))
      .limit(1);

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: "Research project not found" });
    }

    // Update project
    const [updatedProject] = await db
      .update(researchProjects)
      .set({
        ...validatedData,
        updatedAt: new Date(),
        ...(validatedData.status === "completed" && !existing[0].completedAt
          ? { completedAt: new Date() }
          : {}),
      })
      .where(eq(researchProjects.id, id))
      .returning();

    // Audit log
    await logAudit(
      user.id,
      "offsec_rd_project_update",
      `/offsec-rd/projects/${id}`,
      id,
      true,
      req
    );

    res.json({ project: updatedProject });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors
      });
    }
    res.status(500).json({
      error: "Failed to update research project",
      details: error.message
    });
  }
});

// DELETE /api/v1/offsec-rd/projects/:id - Delete research project
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const existing = await db
      .select()
      .from(researchProjects)
      .where(eq(researchProjects.id, id))
      .limit(1);

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: "Research project not found" });
    }

    await db.delete(researchProjects).where(eq(researchProjects.id, id));

    // Audit log
    await logAudit(
      user.id,
      "offsec_rd_project_delete",
      `/offsec-rd/projects/${id}`,
      id,
      true,
      req
    );

    res.json({ message: "Research project deleted successfully" });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to delete research project",
      details: error.message
    });
  }
});

// POST /api/v1/offsec-rd/projects/:id/artifacts - Add artifact to project
router.post("/:id/artifacts", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const artifactSchema = z.object({
      type: z.enum(["code", "report", "poc", "binary", "documentation"]),
      name: z.string().min(1, "Artifact name is required"),
      path: z.string().min(1, "Artifact path is required"),
    });

    const validatedArtifact = artifactSchema.parse(req.body);

    // Get existing project
    const existing = await db
      .select()
      .from(researchProjects)
      .where(eq(researchProjects.id, id))
      .limit(1);

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: "Research project not found" });
    }

    // Add artifact with timestamp
    const newArtifact = {
      ...validatedArtifact,
      createdAt: new Date().toISOString(),
    };

    const currentArtifacts = (existing[0].artifacts as any[]) || [];
    const updatedArtifacts = [...currentArtifacts, newArtifact];

    // Update project with new artifact
    const [updatedProject] = await db
      .update(researchProjects)
      .set({
        artifacts: updatedArtifacts,
        updatedAt: new Date(),
      })
      .where(eq(researchProjects.id, id))
      .returning();

    // Audit log
    await logAudit(
      user.id,
      "offsec_rd_project_artifact_add",
      `/offsec-rd/projects/${id}/artifacts`,
      id,
      true,
      req
    );

    res.status(201).json({ project: updatedProject, artifact: newArtifact });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors
      });
    }
    res.status(500).json({
      error: "Failed to add artifact",
      details: error.message
    });
  }
});

export default router;
