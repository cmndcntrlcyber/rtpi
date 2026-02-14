import { Router } from "express";
import { db } from "../../db";
import { targets, discoveredAssets, discoveredServices } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { dockerExecutor } from "../../services/docker-executor";
import { nmapExecutor } from "../../services/nmap-executor";
import { TargetSanitizer, type TargetType } from "../../../shared/utils/target-sanitizer";
import { ScanTimeoutCalculator } from "../../../shared/utils/scan-timeout-calculator";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/targets - List all targets
router.get("/", async (_req, res) => {
  try {
    const allTargets = await db.select().from(targets);
    res.json({ targets: allTargets });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list targets", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/targets/:id - Get target details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select()
      .from(targets)
      .where(eq(targets.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Target not found" });
    }

    res.json({ target: result[0] });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get target", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/targets - Add new target
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const target = await db
      .insert(targets)
      .values(req.body)
      .returning();

    await logAudit(user.id, "create_target", "/targets", target[0].id, true, req);

    res.status(201).json({ target: target[0] });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "create_target", "/targets", null, false, req);
    res.status(500).json({ error: "Failed to create target", details: error.message });
  }
});

// PUT /api/v1/targets/:id - Update target
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    // Exclude timestamp fields from request body to avoid Date conversion errors
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...updateData } = req.body;

    const result = await db
      .update(targets)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(targets.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Target not found" });
    }

    await logAudit(user.id, "update_target", "/targets", id, true, req);

    res.json({ target: result[0] });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "update_target", "/targets", id, false, req);
    res.status(500).json({ error: "Failed to update target", details: error.message });
  }
});

// DELETE /api/v1/targets/:id - Delete target
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    await db.delete(targets).where(eq(targets.id, id));

    await logAudit(user.id, "delete_target", "/targets", id, true, req);

    res.json({ message: "Target deleted successfully" });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "delete_target", "/targets", id, false, req);
    res.status(500).json({ error: "Failed to delete target", details: error.message });
  }
});

// GET /api/v1/targets/:id/linked-services - Get discovered services linked to this target
router.get("/:id/linked-services", async (req, res) => {
  const { id } = req.params;

  try {
    // Get the target
    const [target] = await db
      .select()
      .from(targets)
      .where(eq(targets.id, id))
      .limit(1);

    if (!target) {
      return res.status(404).json({ error: "Target not found" });
    }

    // Find linked discovered asset(s) via discoveredAssetId or by matching value+operationId
    let linkedAssets;
    if (target.discoveredAssetId) {
      linkedAssets = await db
        .select()
        .from(discoveredAssets)
        .where(eq(discoveredAssets.id, target.discoveredAssetId));
    } else if (target.operationId) {
      linkedAssets = await db
        .select()
        .from(discoveredAssets)
        .where(
          and(
            eq(discoveredAssets.operationId, target.operationId),
            eq(discoveredAssets.value, target.value)
          )
        );
    } else {
      linkedAssets = [];
    }

    if (linkedAssets.length === 0) {
      return res.json({ services: [], asset: null });
    }

    const asset = linkedAssets[0];

    // Fetch discovered services for this asset
    const services = await db
      .select({
        id: discoveredServices.id,
        name: discoveredServices.name,
        port: discoveredServices.port,
        protocol: discoveredServices.protocol,
        version: discoveredServices.version,
        state: discoveredServices.state,
        banner: discoveredServices.banner,
        discoveryMethod: discoveredServices.discoveryMethod,
        discoveredAt: discoveredServices.discoveredAt,
      })
      .from(discoveredServices)
      .where(eq(discoveredServices.assetId, asset.id));

    res.json({
      services,
      asset: {
        id: asset.id,
        value: asset.value,
        type: asset.type,
        hostname: asset.hostname,
        ipAddress: asset.ipAddress,
        status: asset.status,
        discoveryMethod: asset.discoveryMethod,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get linked services", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/targets/:id/scan - Initiate nmap scan
router.post("/:id/scan", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    // Get target details
    const result = await db
      .select()
      .from(targets)
      .where(eq(targets.id, id))
      .limit(1);

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Target not found" });
    }

    const target = result[0];

    // FIX BUG #3: Sanitize target value based on type for nmap compatibility
    const sanitizationResult = TargetSanitizer.sanitizeForNmap(
      target.type as TargetType,
      target.value
    );

    // Log sanitization warnings
    if (sanitizationResult.warnings && sanitizationResult.warnings.length > 0) {
      // Debug logging removed
    }

    // Validate sanitization result
    if (!sanitizationResult.isValid) {
      // Error logged for debugging
      return res.status(400).json({
        error: "Invalid target value",
        details: sanitizationResult.errorMessage,
        originalValue: sanitizationResult.originalValue
      });
    }

    // FIX BUG #4: Calculate appropriate timeout based on target type and size
    const timeoutCalc = ScanTimeoutCalculator.calculateTimeout(
      target.type as TargetType,
      target.value
    );

    // Log timeout calculation details
    // Debug logging removed
    // Debug logging removed
    // Debug logging removed
    console.log(`[Nmap] Host count estimate: ${timeoutCalc.hostCount.toLocaleString()}`);
    console.log(`[Nmap] Estimated duration: ${ScanTimeoutCalculator.formatDuration(timeoutCalc.estimatedDuration)}`);
    console.log(`[Nmap] Timeout set to: ${ScanTimeoutCalculator.formatDuration(timeoutCalc.timeout)}`);
    
    if (timeoutCalc.warning) {
      // Warning logged for debugging
    }

    // Execute nmap scan with SANITIZED target value and DYNAMIC timeout
    // Using sudo for raw socket access, -Pn to skip host discovery, -oX - for XML output
    const scanResult = await dockerExecutor.exec(
      "rtpi-tools",
      ["sudo", "nmap", "-Pn", "-sV", "-T5", "-v5", "-p1-65535", "-oX", "-", sanitizationResult.nmapTarget],
      { timeout: timeoutCalc.timeout }
    );

    // Parse scan results for key information
    const openPorts = (scanResult.stdout.match(/open/gi) || []).length;
    const scanTimestamp = new Date().toISOString();

    // Store results in discoveredAssets and discoveredServices tables
    // so they appear in Surface Assessment and Linked Services views
    let servicesStored = 0;
    if (target.operationId) {
      try {
        const parsed = nmapExecutor.parseXmlOutput(scanResult.stdout);
        const counts = await nmapExecutor.storeResults(parsed, target.operationId, `target-scan-${id}`);
        servicesStored = counts.servicesCount;

        // Link target to the discovered asset (bidirectional)
        if (parsed.hosts.length > 0) {
          const [linkedAsset] = await db
            .select()
            .from(discoveredAssets)
            .where(
              and(
                eq(discoveredAssets.operationId, target.operationId),
                eq(discoveredAssets.value, parsed.hosts[0].ip)
              )
            )
            .limit(1);

          if (linkedAsset) {
            await db.update(targets).set({
              discoveredAssetId: linkedAsset.id,
              updatedAt: new Date(),
            }).where(eq(targets.id, id));

            await db.update(discoveredAssets).set({
              targetId: id,
            }).where(eq(discoveredAssets.id, linkedAsset.id));
          }
        }
      } catch (storeError) {
        console.error("[Nmap] Failed to store results in discoveredServices:", storeError);
      }
    }

    // Store scan summary in metadata for backward compatibility
    const currentMetadata = (target.metadata as any) || {};
    const updatedMetadata = {
      ...currentMetadata,
      lastScan: {
        timestamp: scanTimestamp,
        duration: scanResult.duration,
        openPorts,
        output: scanResult.stdout,
        command: `sudo nmap -Pn -sV -T5 -v5 -p1-65535 -oX - ${sanitizationResult.nmapTarget}`,
        success: scanResult.exitCode === 0,
        sanitization: {
          originalValue: sanitizationResult.originalValue,
          sanitizedValue: sanitizationResult.sanitized,
          warnings: sanitizationResult.warnings || [],
        },
      },
    };

    await db
      .update(targets)
      .set({
        metadata: updatedMetadata,
        updatedAt: new Date(),
      })
      .where(eq(targets.id, id));

    await logAudit(user.id, "scan_target", "/targets", id, true, req);

    res.json({
      message: "Scan completed successfully",
      targetId: id,
      scanOutput: scanResult.stdout,
      scanDuration: scanResult.duration,
      openPorts,
      servicesStored,
      exitCode: scanResult.exitCode,
    });
  } catch (error: any) {
    // Error logged for debugging

    await logAudit(user.id, "scan_target", "/targets", id, false, req);
    
    res.status(500).json({
      error: "Failed to complete scan",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
