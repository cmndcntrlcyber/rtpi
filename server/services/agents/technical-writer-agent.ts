import { BaseTaskAgent, TaskDefinition, TaskResult } from "./base-task-agent";
import { memoryService } from "../memory-service";
import { agentConfig } from "../../config/agent-config";
import { getOpenAIClient, getAnthropicClient } from "../ai-clients";

/**
 * Technical Writer Agent
 * Generates penetration test reports by querying operation memories
 * and interfacing with SysReptor for formatted report output.
 */
export class TechnicalWriterAgent extends BaseTaskAgent {
  private sysReptorUrl: string;
  private sysReptorApiToken: string;

  constructor() {
    super("Technical Writer Agent", "technical_writer", [
      "report_generation",
      "documentation",
      "finding_summarization",
    ]);
    this.sysReptorUrl = process.env.SYSREPTOR_URL || "http://localhost:8000";
    this.sysReptorApiToken = process.env.SYSREPTOR_API_TOKEN || "";
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

      // Submit to SysReptor if available
      let reportUrl: string | null = null;
      if (this.sysReptorApiToken && task.parameters.submitToSysReptor !== false) {
        reportUrl = await this.submitToSysReptor(reportContent, task.parameters);
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

  private async submitToSysReptor(
    content: string,
    params: Record<string, any>,
  ): Promise<string | null> {
    try {
      const response = await fetch(`${this.sysReptorUrl}/api/v1/pentestprojects/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.sysReptorApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: params.reportName || `Pentest Report - ${new Date().toISOString()}`,
          language: "en-US",
          tags: params.tags || [],
        }),
      });

      if (!response.ok) {
        console.error(`[TechnicalWriter] SysReptor API error: ${response.status}`);
        return null;
      }

      const project = await response.json();
      console.log(`[TechnicalWriter] SysReptor project created: ${project.id}`);
      return `${this.sysReptorUrl}/projects/${project.id}`;
    } catch (error) {
      console.error(`[TechnicalWriter] SysReptor submission failed:`, error);
      return null;
    }
  }
}

export const technicalWriterAgent = new TechnicalWriterAgent();
