/**
 * Skill Import Pipeline
 *
 * Orchestrates importing external tool repositories from GitHub,
 * analyzing them, building containers, and registering in the tool registry
 * so agents can execute them via the ToolExecutionLoop.
 *
 * Strategies:
 * 1. Simple binary (Go, Rust) → install into rtpi-tools container
 * 2. Python tool with deps → install into rtpi-research-agent container
 * 3. Complex tool → build new container via AgentToolBuilder
 */

import { db } from "../db";
import { toolRegistry, githubToolInstallations } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { analyzeGitHubRepository } from "./github-tool-installer";
import { agentToolBuilder } from "./agent-tool-builder";
import { multiContainerExecutor } from "./agents/multi-container-executor";
import { DockerExecutor } from "./docker-executor";
import { randomUUID } from "crypto";

// ============================================================================
// Types
// ============================================================================

export interface ImportOptions {
  /** Force rebuild even if tool exists */
  force?: boolean;
  /** Preferred container to install into (default: auto-detect) */
  targetContainer?: string;
  /** Tool category override */
  category?: string;
  /** Agent ID that requested the import */
  requestedByAgentId?: string;
}

export interface ImportResult {
  importId: string;
  status: "completed" | "failed" | "in_progress";
  toolId?: string;
  toolName?: string;
  strategy: "install_binary" | "install_python" | "build_container";
  containerName?: string;
  error?: string;
  duration?: number;
}

interface ImportState {
  id: string;
  githubUrl: string;
  options: ImportOptions;
  status: ImportResult["status"];
  result?: ImportResult;
  startedAt: Date;
}

// ============================================================================
// Strategy detection
// ============================================================================

const SIMPLE_INSTALL_LANGUAGES: Record<string, { container: string; installCmd: (repo: string) => string }> = {
  Go: {
    container: "rtpi-tools",
    installCmd: (repo) => `go install ${repo}@latest`,
  },
  Rust: {
    container: "rtpi-tools",
    installCmd: (repo) => `cargo install --git https://github.com/${repo}`,
  },
};

const PYTHON_INSTALL = {
  container: "rtpi-research-agent",
  installCmd: (repo: string) => `pip3 install git+https://github.com/${repo}`,
};

// ============================================================================
// Skill Import Pipeline
// ============================================================================

export class SkillImportPipeline {
  private imports: Map<string, ImportState> = new Map();
  private dockerExecutor: DockerExecutor;

  constructor() {
    this.dockerExecutor = new DockerExecutor();
  }

  /**
   * Import a tool from a GitHub repository URL.
   */
  async importFromGitHub(githubUrl: string, options: ImportOptions = {}): Promise<ImportResult> {
    const importId = randomUUID();
    const startTime = Date.now();

    const state: ImportState = {
      id: importId,
      githubUrl,
      options,
      status: "in_progress",
      startedAt: new Date(),
    };
    this.imports.set(importId, state);

    try {
      // 1. Check for existing tool
      if (!options.force) {
        const existing = await this.findExistingTool(githubUrl);
        if (existing) {
          const result: ImportResult = {
            importId,
            status: "completed",
            toolId: existing.toolId,
            toolName: existing.name,
            strategy: "install_binary",
            containerName: existing.containerName || undefined,
          };
          state.status = "completed";
          state.result = result;
          return result;
        }
      }

      // 2. Analyze the repository
      console.log(`[SkillImport] Analyzing ${githubUrl}...`);
      const analysis = await analyzeGitHubRepository(githubUrl);

      // 3. Determine strategy
      const strategy = this.determineStrategy(analysis);
      console.log(`[SkillImport] Strategy: ${strategy} for ${analysis.name} (${analysis.primaryLanguage})`);

      // 4. Execute strategy
      let result: ImportResult;

      switch (strategy) {
        case "install_binary":
          result = await this.installBinary(importId, analysis, options);
          break;
        case "install_python":
          result = await this.installPython(importId, analysis, options);
          break;
        case "build_container":
          result = await this.buildContainer(importId, analysis, options);
          break;
        default:
          throw new Error(`Unknown strategy: ${strategy}`);
      }

      result.duration = Date.now() - startTime;
      state.status = result.status;
      state.result = result;
      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[SkillImport] Failed: ${errMsg}`);

      const result: ImportResult = {
        importId,
        status: "failed",
        strategy: "install_binary",
        error: errMsg,
        duration: Date.now() - startTime,
      };
      state.status = "failed";
      state.result = result;
      return result;
    }
  }

  /** Get import status by ID */
  getImport(importId: string): ImportState | undefined {
    return this.imports.get(importId);
  }

  /** List recent imports */
  listImports(limit = 20): ImportState[] {
    return Array.from(this.imports.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  // --------------------------------------------------------------------------
  // Strategy detection
  // --------------------------------------------------------------------------

  private determineStrategy(analysis: any): ImportResult["strategy"] {
    const lang = analysis.primaryLanguage;

    if (lang && SIMPLE_INSTALL_LANGUAGES[lang]) {
      return "install_binary";
    }

    if (lang === "Python") {
      return "install_python";
    }

    // Complex tools or unknown languages → build dedicated container
    return "build_container";
  }

  // --------------------------------------------------------------------------
  // Install strategies
  // --------------------------------------------------------------------------

  private async installBinary(
    importId: string,
    analysis: any,
    options: ImportOptions,
  ): Promise<ImportResult> {
    const lang = analysis.primaryLanguage;
    const config = SIMPLE_INSTALL_LANGUAGES[lang];
    const container = options.targetContainer || config.container;
    const repoPath = `${analysis.owner}/${analysis.name}`;
    const installCmd = config.installCmd(repoPath);

    console.log(`[SkillImport] Installing binary in ${container}: ${installCmd}`);

    const execResult = await this.dockerExecutor.exec(
      container,
      ["bash", "-c", installCmd],
      { timeout: 300000 }, // 5 min
    );

    if (execResult.exitCode !== 0) {
      throw new Error(`Install failed (exit ${execResult.exitCode}): ${execResult.stderr}`);
    }

    // Discover the installed binary
    const binaryName = analysis.name.toLowerCase().replace(/[^a-z0-9-]/g, "");
    const whichResult = await this.dockerExecutor.exec(
      container,
      ["which", binaryName],
      { timeout: 10000 },
    );

    const binaryPath = whichResult.stdout?.trim() || `/usr/local/bin/${binaryName}`;

    // Register in tool registry
    const toolId = await this.registerTool({
      name: analysis.name,
      binaryPath,
      containerName: container,
      containerUser: container === "rtpi-tools" ? "rtpi-tools" : "rtpi-agent",
      category: options.category || "reconnaissance",
      version: analysis.latestRelease || "latest",
      description: analysis.description || `Imported from ${analysis.githubUrl}`,
      githubUrl: analysis.githubUrl,
    });

    return {
      importId,
      status: "completed",
      toolId,
      toolName: analysis.name,
      strategy: "install_binary",
      containerName: container,
    };
  }

  private async installPython(
    importId: string,
    analysis: any,
    options: ImportOptions,
  ): Promise<ImportResult> {
    const container = options.targetContainer || PYTHON_INSTALL.container;
    const repoPath = `${analysis.owner}/${analysis.name}`;
    const installCmd = PYTHON_INSTALL.installCmd(repoPath);

    console.log(`[SkillImport] Installing Python tool in ${container}: ${installCmd}`);

    const execResult = await this.dockerExecutor.exec(
      container,
      ["bash", "-c", installCmd],
      { timeout: 600000 }, // 10 min for Python deps
    );

    if (execResult.exitCode !== 0) {
      throw new Error(`Python install failed (exit ${execResult.exitCode}): ${execResult.stderr}`);
    }

    // Discover the installed entry point
    const toolName = analysis.name.toLowerCase().replace(/[^a-z0-9-]/g, "");
    const whichResult = await this.dockerExecutor.exec(
      container,
      ["bash", "-c", `which ${toolName} || pip3 show ${toolName} 2>/dev/null | grep Location`],
      { timeout: 10000 },
    );

    const binaryPath = whichResult.stdout?.trim().split("\n")[0] || `/usr/local/bin/${toolName}`;

    const toolId = await this.registerTool({
      name: analysis.name,
      binaryPath,
      containerName: container,
      containerUser: "rtpi-agent",
      category: options.category || "reconnaissance",
      version: analysis.latestRelease || "latest",
      description: analysis.description || `Imported from ${analysis.githubUrl}`,
      githubUrl: analysis.githubUrl,
    });

    return {
      importId,
      status: "completed",
      toolId,
      toolName: analysis.name,
      strategy: "install_python",
      containerName: container,
    };
  }

  private async buildContainer(
    importId: string,
    analysis: any,
    options: ImportOptions,
  ): Promise<ImportResult> {
    // Delegate to the existing AgentToolBuilder which handles:
    // - LLM-powered Dockerfile generation
    // - Docker build with auto-repair (up to 3 attempts)
    // - Container start
    // - MCP server registration
    console.log(`[SkillImport] Building container for ${analysis.name} via AgentToolBuilder`);

    // Create a build record via the agent tool builder
    const buildName = `skill-import-${analysis.name}`;
    const agentId = options.requestedByAgentId || "system";

    // The agent-tool-builder's startBuild expects a DB record with githubUrls
    // For now, delegate to its full pipeline
    const [buildRecord] = await db
      .insert(require("@shared/schema").agentToolBuilds)
      .values({
        name: buildName,
        mode: "create",
        agentId,
        githubUrls: [analysis.githubUrl],
        status: "pending",
      })
      .returning();

    // Start the build asynchronously
    agentToolBuilder.startBuild(buildRecord.id).catch((err: any) => {
      console.error(`[SkillImport] Container build failed:`, err);
    });

    return {
      importId,
      status: "in_progress",
      toolName: analysis.name,
      strategy: "build_container",
    };
  }

  // --------------------------------------------------------------------------
  // Tool registry
  // --------------------------------------------------------------------------

  private async registerTool(params: {
    name: string;
    binaryPath: string;
    containerName: string;
    containerUser: string;
    category: string;
    version: string;
    description: string;
    githubUrl: string;
  }): Promise<string> {
    const toolId = params.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    // Check for conflicts
    const [existing] = await db
      .select()
      .from(toolRegistry)
      .where(eq(toolRegistry.toolId, toolId))
      .limit(1);

    if (existing) {
      // Update existing
      await db
        .update(toolRegistry)
        .set({
          binaryPath: params.binaryPath,
          containerName: params.containerName,
          containerUser: params.containerUser,
          version: params.version,
          description: params.description,
          installStatus: "installed",
          validationStatus: "pending",
          updatedAt: new Date(),
        })
        .where(eq(toolRegistry.toolId, toolId));

      console.log(`[SkillImport] Updated existing tool: ${toolId}`);
      return toolId;
    }

    // Insert new
    await db.insert(toolRegistry).values({
      toolId,
      name: params.name,
      binaryPath: params.binaryPath,
      containerName: params.containerName,
      containerUser: params.containerUser,
      category: params.category as any,
      version: params.version,
      description: params.description,
      installMethod: "github-source" as any,
      installStatus: "installed",
      validationStatus: "pending",
    });

    console.log(`[SkillImport] Registered new tool: ${toolId}`);

    // Refresh the multi-container executor cache
    await multiContainerExecutor.refreshCache();

    return toolId;
  }

  private async findExistingTool(githubUrl: string): Promise<any | null> {
    // Check if this GitHub URL was already imported
    const [existing] = await db
      .select()
      .from(githubToolInstallations)
      .where(eq(githubToolInstallations.githubUrl, githubUrl))
      .limit(1);

    if (!existing) return null;

    // Check if tool is still registered
    const toolName = existing.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const [tool] = await db
      .select()
      .from(toolRegistry)
      .where(eq(toolRegistry.toolId, toolName))
      .limit(1);

    return tool || null;
  }
}

export const skillImportPipeline = new SkillImportPipeline();
