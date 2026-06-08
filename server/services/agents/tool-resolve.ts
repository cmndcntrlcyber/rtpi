/**
 * Canonical agent-tool execution result + unified tool resolution.
 *
 * Consolidation (INTEROP-EVALUATION.md §4): every agent-tool execution path
 * returns the SAME typed shape, and tool lookup happens through ONE resolver
 * instead of ad-hoc `getToolById` → `securityTools` fallbacks scattered per call
 * site. `formatted` carries the human-readable summary so string-consumers
 * (e.g. the workflow orchestrator) keep working while structured consumers
 * (e.g. the tools API) read `exitCode`/`stdout`/`stderr` directly.
 */

import { db } from "../../db";
import { securityTools } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getToolById } from "../tool-registry-manager";

export interface AgentToolResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  /** Human-readable summary (back-compat for callers that consumed the old
   *  string return). */
  formatted: string;
}

export interface ResolvedTool {
  tool: any;
  /** Which registry the row came from. */
  source: "registry" | "security";
  /** True only for an installed tool_registry row (the new-framework path). */
  installed: boolean;
}

/**
 * Resolve a tool id to its row, preferring the operational `tool_registry`
 * (new framework) and falling back to the legacy `security_tools` table.
 * Returns null when neither has it. Single source of resolution for every
 * execution path.
 */
export async function resolveTool(toolId: string): Promise<ResolvedTool | null> {
  const registryTool: any = await getToolById(toolId);
  if (registryTool) {
    return {
      tool: registryTool,
      source: "registry",
      installed: registryTool.installStatus === "installed",
    };
  }

  const [legacy] = await db
    .select()
    .from(securityTools)
    .where(eq(securityTools.id, toolId))
    .limit(1);

  if (legacy) {
    return { tool: legacy, source: "security", installed: false };
  }

  return null;
}
