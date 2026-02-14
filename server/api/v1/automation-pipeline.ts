/**
 * Automation Pipeline API
 *
 * REST endpoints for pipeline status monitoring, manual triggers,
 * and configuration of the Phase 3 operations automation.
 */

import { Router } from "express";
import { db } from "../../db";
import { operations, targets, discoveredAssets, axScanResults } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { ensureAuthenticated, ensureRole } from "../../auth/middleware";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// ============================================================================
// Pipeline Status
// ============================================================================

/**
 * GET /:operationId/status - Get pipeline status for an operation
 */
router.get("/:operationId/status", async (req, res) => {
  const { operationId } = req.params;

  try {
    const [operation] = await db
      .select()
      .from(operations)
      .where(eq(operations.id, operationId));

    if (!operation) {
      return res.status(404).json({ error: "Operation not found" });
    }

    // Get recent scans for this operation
    const recentScans = await db
      .select()
      .from(axScanResults)
      .where(eq(axScanResults.operationId, operationId))
      .orderBy(desc(axScanResults.createdAt))
      .limit(20);

    res.json({
      operationId,
      operationName: operation.name,
      operationStatus: operation.status,
      automationEnabled: operation.automationEnabled,
      pipelineStatus: operation.pipelineStatus || { currentPhase: 'idle', phases: [] },
      recentScans: recentScans.map(s => ({
        id: s.id,
        toolName: s.toolName,
        status: s.status,
        assetsFound: s.assetsFound,
        servicesFound: s.servicesFound,
        vulnerabilitiesFound: s.vulnerabilitiesFound,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        duration: s.duration,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get pipeline status", details: error?.message });
  }
});

// ============================================================================
// Pipeline Control
// ============================================================================

/**
 * POST /:operationId/trigger - Manual pipeline trigger
 * Body: { startFrom?: 'bbot' | 'nmap' | 'nuclei' }
 */
router.post("/:operationId/trigger", ensureRole("admin", "operator"), async (req, res) => {
  const { operationId } = req.params;
  const { startFrom = 'bbot' } = req.body;
  const user = req.user as any;

  try {
    const [operation] = await db
      .select()
      .from(operations)
      .where(eq(operations.id, operationId));

    if (!operation) {
      return res.status(404).json({ error: "Operation not found" });
    }

    const { workflowEventHandlers } = await import('../../services/workflow-event-handlers');

    if (startFrom === 'bbot') {
      const { operationLifecycleAutomation } = await import('../../services/operation-lifecycle-automation');
      await operationLifecycleAutomation.handleOperationActivated(operationId, user.id);
    } else if (startFrom === 'nmap') {
      // Get existing auto-created targets and start nmap
      const autoTargets = await db
        .select()
        .from(targets)
        .where(
          and(
            eq(targets.operationId, operationId),
            eq(targets.autoCreated, true)
          )
        );

      if (autoTargets.length === 0) {
        return res.status(400).json({ error: "No auto-created targets found. Run BBOT first." });
      }

      const { nmapExecutor } = await import('../../services/nmap-executor');
      const targetValues = autoTargets.map(t => t.value);
      await nmapExecutor.startScan(targetValues, { ports: '1-1024' }, operationId, user.id);
    } else if (startFrom === 'nuclei') {
      // Trigger nuclei manually - user must provide targets
      const nucleiTargets = req.body.targets;
      if (!nucleiTargets || !Array.isArray(nucleiTargets) || nucleiTargets.length === 0) {
        return res.status(400).json({ error: "targets array required for nuclei trigger" });
      }

      const { nucleiExecutor } = await import('../../services/nuclei-executor');
      await nucleiExecutor.startScan(nucleiTargets, {}, operationId, user.id);
    } else {
      return res.status(400).json({ error: "Invalid startFrom value", validValues: ['bbot', 'nmap', 'nuclei'] });
    }

    res.json({ message: `Pipeline triggered from ${startFrom}`, operationId });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to trigger pipeline", details: error?.message });
  }
});

/**
 * POST /:operationId/pause - Pause pipeline
 */
router.post("/:operationId/pause", ensureRole("admin", "operator"), async (req, res) => {
  const { operationId } = req.params;

  try {
    const { operationLifecycleAutomation } = await import('../../services/operation-lifecycle-automation');
    await operationLifecycleAutomation.handleOperationPaused(operationId);
    res.json({ message: "Pipeline paused", operationId });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to pause pipeline", details: error?.message });
  }
});

/**
 * POST /:operationId/resume - Resume pipeline from paused state
 */
router.post("/:operationId/resume", ensureRole("admin", "operator"), async (req, res) => {
  const { operationId } = req.params;
  const user = req.user as any;

  try {
    const [operation] = await db
      .select()
      .from(operations)
      .where(eq(operations.id, operationId));

    if (!operation) {
      return res.status(404).json({ error: "Operation not found" });
    }

    const pipelineStatus = operation.pipelineStatus as any;
    if (!pipelineStatus || pipelineStatus.currentPhase !== 'paused') {
      return res.status(400).json({ error: "Pipeline is not paused" });
    }

    // Find the last completed phase and resume from the next one
    const phases = pipelineStatus.phases || [];
    const lastCompleted = [...phases].reverse().find((p: any) => p.status === 'completed');
    const phaseOrder = ['bbot', 'target_creation', 'nmap', 'nuclei', 'reporting'];
    let resumeFrom = 'bbot';

    if (lastCompleted) {
      const idx = phaseOrder.indexOf(lastCompleted.name);
      if (idx >= 0 && idx < phaseOrder.length - 1) {
        resumeFrom = phaseOrder[idx + 1];
      }
    }

    const { operationLifecycleAutomation } = await import('../../services/operation-lifecycle-automation');
    await operationLifecycleAutomation.handleOperationActivated(operationId, user.id);

    res.json({ message: `Pipeline resumed from ${resumeFrom}`, operationId });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to resume pipeline", details: error?.message });
  }
});

// ============================================================================
// Auto-Created Targets
// ============================================================================

/**
 * GET /:operationId/targets/auto-created - List auto-created targets
 */
router.get("/:operationId/targets/auto-created", async (req, res) => {
  const { operationId } = req.params;

  try {
    const autoTargets = await db
      .select()
      .from(targets)
      .where(
        and(
          eq(targets.operationId, operationId),
          eq(targets.autoCreated, true)
        )
      )
      .orderBy(desc(targets.createdAt));

    res.json({
      operationId,
      count: autoTargets.length,
      targets: autoTargets,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get auto-created targets", details: error?.message });
  }
});

/**
 * POST /:operationId/targets/auto-create - Manual target auto-creation
 */
router.post("/:operationId/targets/auto-create", ensureRole("admin", "operator"), async (req, res) => {
  const { operationId } = req.params;

  try {
    // Get the most recent BBOT scan for this operation
    const [lastBBOTScan] = await db
      .select()
      .from(axScanResults)
      .where(
        and(
          eq(axScanResults.operationId, operationId),
          eq(axScanResults.toolName, 'bbot')
        )
      )
      .orderBy(desc(axScanResults.createdAt))
      .limit(1);

    const scanId = lastBBOTScan?.id || operationId; // fallback to operationId if no scan

    const { targetAutoCreationService } = await import('../../services/target-auto-creation-service');
    const result = await targetAutoCreationService.autoCreateTargetsFromAssets(operationId, scanId);

    res.json({
      message: "Target auto-creation complete",
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to auto-create targets", details: error?.message });
  }
});

// ============================================================================
// Configuration
// ============================================================================

/**
 * GET /config - Get current automation configuration
 */
router.get("/config", async (_req, res) => {
  try {
    const { workflowEventHandlers } = await import('../../services/workflow-event-handlers');
    res.json(workflowEventHandlers.getConfig());
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get config", details: error?.message });
  }
});

/**
 * PATCH /config - Update automation configuration
 */
router.patch("/config", ensureRole("admin"), async (req, res) => {
  try {
    const { workflowEventHandlers } = await import('../../services/workflow-event-handlers');
    workflowEventHandlers.updateConfig(req.body);
    res.json(workflowEventHandlers.getConfig());
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update config", details: error?.message });
  }
});

export default router;
