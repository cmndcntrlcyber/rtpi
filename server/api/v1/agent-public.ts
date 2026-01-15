/**
 * Public Agent Download API
 *
 * Provides token-based download endpoint for agent bundles.
 * No authentication required - access is controlled via time-limited tokens.
 */

import { Router } from "express";
import { promises as fs } from "fs";
import { agentTokenService } from "../../services/agent-token-service";
import { db } from "../../db";
import { agentBundles } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * Download agent bundle via token (public endpoint)
 *
 * GET /api/v1/public/agents/download/:token
 *
 * This endpoint does not require authentication.
 * Access is controlled via the download token.
 */
router.get("/agents/download/:token", async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Token is required" });
    }

    // Get client IP for logging and optional IP restrictions
    const clientIp =
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    // Validate token
    const validation = await agentTokenService.validateToken(token, clientIp);

    if (!validation.valid) {
      console.warn(
        `[AgentPublic] Token validation failed: ${validation.errorMessage} (IP: ${clientIp})`
      );

      // Return appropriate error response
      switch (validation.errorMessage) {
        case "Token not found":
          return res.status(404).json({ error: "Invalid download link" });
        case "Token has been revoked":
          return res.status(410).json({ error: "Download link has been revoked" });
        case "Token has expired":
          return res.status(410).json({ error: "Download link has expired" });
        case "Download limit exceeded":
          return res
            .status(429)
            .json({ error: "Download limit reached for this link" });
        case "IP address not allowed":
          return res.status(403).json({ error: "Access denied from this location" });
        default:
          return res.status(403).json({ error: "Access denied" });
      }
    }

    // Get bundle
    const bundle = await db.query.agentBundles.findFirst({
      where: eq(agentBundles.id, validation.bundleId!),
    });

    if (!bundle) {
      return res.status(404).json({ error: "Bundle not found" });
    }

    // Check file exists
    try {
      await fs.access(bundle.filePath);
    } catch {
      // Error logged for debugging
      return res.status(404).json({ error: "Bundle file not found" });
    }

    // Record the download
    await agentTokenService.recordDownload(token);

    // Log successful download
    console.log(
      `[AgentPublic] Download successful: ${bundle.name} (${bundle.platform}/${bundle.architecture}) - IP: ${clientIp}`
    );

    // Set headers and stream file
    const fileName = `${bundle.name}-${bundle.platform}-${bundle.architecture}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", bundle.fileSize);

    // Add cache control headers to prevent caching of download
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // Stream the file
    const fileContent = await fs.readFile(bundle.filePath);
    res.send(fileContent);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Download failed", details: error?.message || "Internal server error" });
  }
});

/**
 * Check token validity (public endpoint)
 *
 * GET /api/v1/public/agents/check/:token
 *
 * Returns token status without incrementing download count.
 * Useful for UI to show token status before attempting download.
 */
router.get("/agents/check/:token", async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Token is required" });
    }

    const clientIp =
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    const validation = await agentTokenService.validateToken(token, clientIp);

    if (!validation.valid) {
      return res.json({
        valid: false,
        reason: validation.errorMessage,
      });
    }

    // Get bundle info (without sensitive details)
    const bundle = await db.query.agentBundles.findFirst({
      where: eq(agentBundles.id, validation.bundleId!),
    });

    res.json({
      valid: true,
      bundle: bundle
        ? {
            name: bundle.name,
            platform: bundle.platform,
            architecture: bundle.architecture,
            fileSize: bundle.fileSize,
          }
        : null,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to check token", details: error?.message || "Internal server error" });
  }
});

export default router;
