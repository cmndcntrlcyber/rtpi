import { BaseTaskAgent, TaskDefinition, TaskResult } from "./base-task-agent";
import { memoryService } from "../memory-service";
import { agentConfig } from "../../config/agent-config";
import { getOpenAIClient, getAnthropicClient } from "../ai-clients";
import { sysReptorClient } from "../sysreptor-client";
import { db } from "../../db";
import { vulnerabilities, operations } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Technical Writer Agent
 * Generates penetration test reports by querying operation memories
 * and interfacing with SysReptor for formatted report output.
 */
export class TechnicalWriterAgent extends BaseTaskAgent {
  constructor() {
    super("Technical Writer Agent", "technical_writer", [
      "report_generation",
      "documentation",
      "finding_summarization",
    ]);
  }

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    await this.updateStatus("running");

    try {
      // Query memory for operation findings
      const memories = await this.getRelevantMemories({
        operationId: task.operationId,
        taskType: "report_generation",
        limit: 100,
      });

      // Generate report content using AI
      const reportContent = await this.generateReportContent(
        memories,
        task.parameters.template || "pentest",
        task.parameters,
      );

      // Submit to SysReptor if available — full project with findings
      let reportUrl: string | null = null;
      let findingsExported = 0;
      if (sysReptorClient.configured && task.parameters.submitToSysReptor !== false) {
        const result = await this.submitToSysReptor(reportContent, task);
        reportUrl = result.url;
        findingsExported = result.findingsExported;
      }

      // Store task result in memory
      const memoryId = await this.storeTaskMemory({
        task,
        result: {
          success: true,
          data: {
            reportContent: reportContent.substring(0, 500),
            reportUrl,
            findingsCount: memories.length,
            findingsExported,
          },
        },
        memoryType: "event",
      });

      await this.updateStatus("idle");

      return {
        success: true,
        data: {
          reportContent,
          reportUrl,
          findingsCount: memories.length,
          findingsExported,
          memoryId,
        },
      };
    } catch (error) {
      await this.updateStatus("error");
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[TechnicalWriter] Task failed:`, errMsg);
      return { success: false, error: errMsg };
    }
  }

  private async generateReportContent(
    memories: any[],
    template: string,
    params: Record<string, any>,
  ): Promise<string> {
    const findingsSummary = memories
      .map((m) => `- ${m.memoryText}`)
      .join("\n");

    const prompt = `Generate a ${template} penetration test report section based on the following findings:

${findingsSummary}

Operation: ${params.operationName || "Unknown"}
Scope: ${params.scope || "Not specified"}

Format the output as a professional penetration test report with:
1. Executive Summary
2. Findings Summary (categorized by severity)
3. Detailed Findings
4. Recommendations
5. Conclusion`;

    const config = agentConfig.taskAgent.aiModel;
    const anthropic = getAnthropicClient();
    const openai = getOpenAIClient();

    if (config.provider === "anthropic" && anthropic) {
      const response = await anthropic.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [{ role: "user", content: prompt }],
      });
      const block = response.content[0];
      return block.type === "text" ? block.text : "";
    }

    if (openai) {
      const response = await openai.chat.completions.create({
        model: config.model === "claude-sonnet-4-5" ? "gpt-5.2-chat-latest" : config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [{ role: "user", content: prompt }],
      });
      return response.choices[0]?.message?.content || "";
    }

    return `# Report Generated (No AI Provider Available)\n\n## Findings\n${findingsSummary}`;
  }

  /**
   * Submit full project to SysReptor with findings, sections, and metadata
   */
  private async submitToSysReptor(
    content: string,
    task: TaskDefinition,
  ): Promise<{ url: string | null; findingsExported: number }> {
    const params = task.parameters;
    try {
      // 1. Create project (optionally with a design template)
      const projectName = params.reportName || `Pentest Report - ${new Date().toISOString().split("T")[0]}`;
      const project = await sysReptorClient.createProject(
        projectName,
        params.designId,
        params.tags || ["rtpi", "automated"],
      );

      console.log(`[TechnicalWriter] SysReptor project created: ${project.id}`);

      // 2. Fetch and push all operation vulnerabilities as findings
      let findingsExported = 0;
      if (task.operationId) {
        const vulns = await db
          .select()
          .from(vulnerabilities)
          .where(eq(vulnerabilities.operationId, task.operationId));

        const validVulns = vulns.filter((v) => v.status !== "false_positive");

        for (const vuln of validVulns) {
          try {
            await sysReptorClient.addFinding(project.id, {
              title: vuln.title,
              severity: vuln.severity,
              description: vuln.description,
              cvssScore: vuln.cvssScore,
              cvssVector: vuln.cvssVector,
              cveId: vuln.cveId,
              cweId: vuln.cweId,
              proofOfConcept: vuln.proofOfConcept,
              remediation: vuln.remediation,
              impact: vuln.impact,
              exploitability: vuln.exploitability,
              affectedServices: vuln.affectedServices,
              references: vuln.references,
              status: vuln.status,
            });
            findingsExported++;
          } catch (err) {
            console.error(
              `[TechnicalWriter] Failed to add finding "${vuln.title}":`,
              err instanceof Error ? err.message : err,
            );
          }
        }

        console.log(`[TechnicalWriter] Exported ${findingsExported}/${validVulns.length} findings`);

        // 3. Populate report sections with operation context
        try {
          const [operation] = await db
            .select()
            .from(operations)
            .where(eq(operations.id, task.operationId))
            .limit(1);

          if (operation) {
            const sections = await sysReptorClient.getSections(project.id);
            for (const section of sections) {
              const label = section.label?.toLowerCase() || "";
              let sectionData: Record<string, any> | null = null;

              if (label.includes("executive") || label.includes("summary")) {
                // Use AI-generated content for executive summary
                sectionData = { executive_summary: content.substring(0, 5000) };
              } else if (label.includes("scope")) {
                sectionData = { scope: operation.scope || params.scope || "" };
              }

              if (sectionData) {
                await sysReptorClient.updateSection(project.id, section.id, sectionData);
              }
            }
          }
        } catch (err) {
          console.warn("[TechnicalWriter] Could not populate sections:", err instanceof Error ? err.message : err);
        }
      }

      const url = `${process.env.SYSREPTOR_URL || "http://rtpi-sysreptor-app:8000"}/projects/${project.id}`;
      return { url, findingsExported };
    } catch (error) {
      console.error(`[TechnicalWriter] SysReptor submission failed:`, error);
      return { url: null, findingsExported: 0 };
    }
  }
}

export const technicalWriterAgent = new TechnicalWriterAgent();
