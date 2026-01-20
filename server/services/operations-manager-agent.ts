import { db } from "../db";
import {
  operations,
  operationsManagerTasks,
  assetQuestions,
  agentActivityReports,
  workflowTasks,
  agents,
  discoveredAssets,
  reports,
} from "../../shared/schema";
import { eq, inArray } from "drizzle-orm";
import { ollamaAIClient } from "./ollama-ai-client";

/**
 * Operations Manager Agent Service
 *
 * The Operations Manager is responsible for:
 * - Synthesizing reports from all page reporters
 * - Analyzing overall operation status
 * - Autonomously updating operation status with rationale
 * - Generating questions about discovered assets
 * - Identifying cross-page roadblocks
 */
class OperationsManagerAgent {
  /**
   * Execute the Operations Manager
   *
   * @param operationId - ID of the operation
   * @param reporterTaskIds - IDs of reporter tasks to synthesize
   * @returns Manager execution results
   */
  async executeOperationsManager(operationId: string, reporterTaskIds: string[]): Promise<any> {
    console.log(
      `🧠 [OperationsManagerAgent] Executing for operation ${operationId} with ${reporterTaskIds.length} reporter tasks`
    );

    try {
      // Get operation
      const operation = await db.select().from(operations).where(eq(operations.id, operationId)).limit(1);

      if (operation.length === 0) {
        throw new Error(`Operation ${operationId} not found`);
      }

      const currentOperation = operation[0];

      // Get operations manager agent
      const manager = await this.getOperationsManagerAgent();
      if (!manager) {
        throw new Error("Operations Manager agent not found");
      }

      // Collect all reporter outputs
      const reports = await this.collectReports(reporterTaskIds);

      console.log(`📊 [OperationsManagerAgent] Collected ${reports.length} reports`);

      // Call AI for analysis
      const analysis = await this.callManagerAI(currentOperation, reports);

      console.log(`✅ [OperationsManagerAgent] AI analysis complete`);

      // Update operation status if recommended
      if (analysis.shouldUpdateStatus) {
        await db
          .update(operations)
          .set({
            status: analysis.recommendedStatus,
            managementStatus: {
              assessment: analysis.statusAssessment,
              rationale: analysis.statusChangeRationale,
              updatedAt: new Date().toISOString(),
            },
            lastManagerUpdate: new Date(),
          })
          .where(eq(operations.id, operationId));

        console.log(`🔄 [OperationsManagerAgent] Updated operation status to: ${analysis.recommendedStatus}`);

        // Log decision
        await db.insert(operationsManagerTasks).values({
          taskType: "status_update",
          taskName: "Autonomous Status Update",
          taskDescription: `Updated operation status from ${currentOperation.status} to ${analysis.recommendedStatus}`,
          operationId,
          managerAgentId: manager.id,
          status: "completed",
          priority: 7,
          involvedAgents: reporterTaskIds,
          reportsSynthesized: reports.map((r) => r.id),
          decisions: [
            {
              decision: `Status changed: ${currentOperation.status} → ${analysis.recommendedStatus}`,
              reasoning: analysis.statusChangeRationale,
              timestamp: new Date().toISOString(),
            },
          ],
          startedAt: new Date(),
          completedAt: new Date(),
        });
      }

      // Create asset questions
      for (const question of analysis.userQuestions) {
        await db.insert(assetQuestions).values({
          assetId: question.assetId,
          operationId,
          question: question.question,
          questionType: question.questionType || "context",
          askedBy: manager.id,
          status: "pending",
          metadata: {
            priority: question.priority,
            context: question.context,
          },
        });

        console.log(`❓ [OperationsManagerAgent] Created question: ${question.question}`);
      }

      // Store synthesis report
      const synthesisReport = {
        statusAssessment: analysis.statusAssessment,
        recommendedStatus: analysis.recommendedStatus,
        statusChangeRationale: analysis.statusChangeRationale,
        shouldUpdateStatus: analysis.shouldUpdateStatus,
        userQuestions: analysis.userQuestions,
        criticalRoadblocks: analysis.criticalRoadblocks,
        keyInsights: analysis.keyInsights,
        reportsSynthesized: reports.length,
        timestamp: new Date().toISOString(),
      };

      await db.insert(reports).values({
        name: `Operations Management Synthesis - ${new Date().toISOString()}`,
        type: "operations_manager_synthesis",
        operationId,
        content: synthesisReport,
        status: "completed",
        format: "markdown",
        generatedBy: currentOperation.ownerId,
      });

      // Create synthesis task
      await db.insert(operationsManagerTasks).values({
        taskType: "synthesis",
        taskName: "Report Synthesis",
        taskDescription: `Synthesized ${reports.length} page reporter reports`,
        operationId,
        managerAgentId: manager.id,
        status: "completed",
        priority: 5,
        involvedAgents: reporterTaskIds,
        reportsSynthesized: reports.map((r) => r.id),
        inputData: { reporterTaskIds },
        outputData: synthesisReport,
        startedAt: new Date(),
        completedAt: new Date(),
      });

      return {
        synthesisCompleted: true,
        statusUpdated: analysis.shouldUpdateStatus,
        newStatus: analysis.shouldUpdateStatus ? analysis.recommendedStatus : null,
        questionsGenerated: analysis.userQuestions.length,
        roadblocksIdentified: analysis.criticalRoadblocks.length,
        reportsAnalyzed: reports.length,
      };
    } catch (error) {
      console.error(
        `❌ [OperationsManagerAgent] Failed to execute:`,
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  /**
   * Collect reports from reporter tasks
   */
  private async collectReports(taskIds: string[]): Promise<any[]> {
    if (taskIds.length === 0) {
      return [];
    }

    // Get task outputs
    const tasks = await db.select().from(workflowTasks).where(inArray(workflowTasks.id, taskIds));

    // Get corresponding reports
    const reportIds = tasks
      .filter((t) => t.outputData && (t.outputData as any).reportId)
      .map((t) => (t.outputData as any).reportId);

    if (reportIds.length === 0) {
      console.warn("⚠️  [OperationsManagerAgent] No report IDs found in task outputs");
      return [];
    }

    const reportsList = await db
      .select()
      .from(agentActivityReports)
      .where(inArray(agentActivityReports.id, reportIds));

    return reportsList;
  }

  /**
   * Call AI for operations management analysis
   */
  private async callManagerAI(operation: typeof operations.$inferSelect, reports: any[]): Promise<any> {
    const systemPrompt = `You are an Operations Manager for penetration testing operations.
You receive hourly reports from specialized page reporters. Your responsibilities:
1. Synthesize reports into overall status assessment
2. Autonomously update operation status with clear rationale
3. Generate specific questions for users about newly discovered assets
4. Identify roadblocks requiring attention
5. Log all decisions for audit trail

You have authority to change operation status. Always provide clear reasoning.

Status transitions:
- planning → active: When targets are defined and testing has begun
- active → paused: When blocking issues prevent progress
- active → completed: When objectives are met
- Any → failed: When critical failures prevent continuation`;

    const aggregatedReports = reports.map((r) => ({
      pageRole: r.agentPageRole,
      summary: r.activitySummary,
      metrics: r.keyMetrics,
      changes: r.changesDetected,
      issues: r.issuesReported,
      recommendations: r.recommendations,
    }));

    const userPrompt = `
Operation: ${operation.name}
Current Status: ${operation.status}
Reporting Period: ${new Date().toISOString()}

Page Reports (${reports.length} reports):
${JSON.stringify(aggregatedReports, null, 2)}

Tasks:
1. Analyze all reports for patterns and critical issues
2. Determine if operation status should change (planning→active, active→paused, etc.)
3. List newly discovered assets requiring user input (if applicable)
4. Identify cross-page roadblocks
5. Provide status update rationale

Respond in JSON:
{
  "statusAssessment": "Overall analysis of the operation's current state...",
  "recommendedStatus": "planning|active|paused|completed|cancelled",
  "statusChangeRationale": "Clear explanation of why status should change (or why it should stay the same)...",
  "shouldUpdateStatus": true|false,
  "userQuestions": [
    {
      "assetId": "asset-uuid",
      "question": "Is domain staging.example.com in scope?",
      "questionType": "scope",
      "priority": "high",
      "context": {}
    }
  ],
  "criticalRoadblocks": ["Description of any blocking issues..."],
  "keyInsights": ["Important observations from the reports..."]
}
`;

    try {
      const response = await ollamaAIClient.complete(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        {
          provider: "auto",
          temperature: 0.3, // Lower temperature for more consistent analysis
          maxTokens: 2000,
        }
      );

      if (!response.success) {
        throw new Error(`AI completion failed: ${response.error}`);
      }

      // Parse JSON response
      let analysis;
      try {
        // Extract JSON from markdown code blocks if present
        const content = response.content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
        analysis = JSON.parse(content);
      } catch (parseError) {
        console.error("Failed to parse AI response:", response.content);
        throw new Error("Failed to parse AI response as JSON");
      }

      // Validate required fields
      if (!analysis.statusAssessment || !analysis.recommendedStatus) {
        throw new Error("AI response missing required fields");
      }

      // Ensure arrays exist
      analysis.userQuestions = analysis.userQuestions || [];
      analysis.criticalRoadblocks = analysis.criticalRoadblocks || [];
      analysis.keyInsights = analysis.keyInsights || [];

      return analysis;
    } catch (error) {
      console.error("❌ [OperationsManagerAgent] AI call failed:", error);

      // Fallback to basic analysis
      return {
        statusAssessment: `Analyzed ${reports.length} reports. AI analysis failed, using fallback.`,
        recommendedStatus: operation.status,
        statusChangeRationale: "Maintaining current status due to AI analysis failure",
        shouldUpdateStatus: false,
        userQuestions: [],
        criticalRoadblocks: ["AI analysis unavailable"],
        keyInsights: [],
      };
    }
  }

  /**
   * Get the operations manager agent
   */
  private async getOperationsManagerAgent(): Promise<typeof agents.$inferSelect | null> {
    const allAgents = await db.select().from(agents);

    const manager = allAgents.find((agent) => {
      const config = agent.config as any;
      return config?.role === "operations_manager";
    });

    return manager || null;
  }
}

// Singleton instance
export const operationsManagerAgent = new OperationsManagerAgent();
