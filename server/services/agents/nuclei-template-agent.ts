/**
 * Nuclei Template Agent (v2.4 Phase 3)
 *
 * Generates and optimizes Nuclei vulnerability detection templates.
 * Wraps rdTeamAgent with similar-template lookup for context-aware
 * generation and persists artifacts to the rdArtifacts table.
 */

import { BaseTaskAgent, TaskDefinition, TaskResult } from './base-task-agent';
import { db } from '../../db';
import { rdArtifacts, nucleiTemplates } from '@shared/schema';
import { eq, ilike, desc } from 'drizzle-orm';
import { rdTeamAgent } from './rd-team-agent';
import { ollamaAIClient } from '../ollama-ai-client';
import type { NucleiTemplateArtifact } from '../rd-experiment-orchestrator';

// ============================================================================
// Nuclei Template Agent
// ============================================================================

class NucleiTemplateAgent extends BaseTaskAgent {
  constructor() {
    super(
      'Nuclei Template Agent',
      'nuclei_template_developer',
      ['template_generation', 'template_optimization']
    );
  }

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    await this.updateStatus('running');

    try {
      switch (task.taskType) {
        case 'template_generation':
          return await this.handleTemplateGeneration(task);
        case 'template_optimization':
          return await this.handleTemplateOptimization(task);
        default:
          return { success: false, error: `Unknown task type: ${task.taskType}` };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    } finally {
      await this.updateStatus('idle');
    }
  }

  private async handleTemplateGeneration(task: TaskDefinition): Promise<TaskResult> {
    const {
      cveId,
      vulnerabilityId,
      operationId,
      projectId,
      experimentId,
      title,
      description,
      severity,
      service,
    } = task.parameters;

    // Look up similar templates for context
    const similarTemplates = await this.findSimilarTemplates(service, cveId);

    // Delegate to rd-team-agent with enriched context
    if (!rdTeamAgent.isInitialized) {
      await rdTeamAgent.initialize();
    }

    const result = await rdTeamAgent.executeTask({
      taskType: 'nuclei_template_generation',
      taskName: task.taskName,
      description: task.description,
      operationId,
      parameters: {
        vulnerabilityId,
        cveId,
        title,
        description,
        severity,
        service,
        // Provide similar templates as additional context
        similarTemplateContext: similarTemplates.length > 0
          ? `Existing templates for similar vulnerabilities:\n${similarTemplates.map(t => `--- ${t.name} (${t.severity}) ---\n${t.content?.substring(0, 500)}`).join('\n\n')}`
          : undefined,
      },
    });

    if (!result.success) {
      return result;
    }

    // Build artifact
    const artifact: NucleiTemplateArtifact = {
      type: 'nuclei_template',
      templateId: result.data?.templateId || `custom-${vulnerabilityId?.substring(0, 8) || 'gen'}`,
      yamlContent: result.data?.template || result.data?.yamlContent || '',
      severity: severity || 'medium',
      matchers: result.data?.matchers || [],
      extractors: result.data?.extractors,
      metadata: {
        verified: false,
        falsePositiveRate: undefined,
      },
    };

    // Persist to rdArtifacts
    let artifactId: string | undefined;
    if (experimentId && projectId) {
      const [inserted] = await db.insert(rdArtifacts).values({
        experimentId,
        projectId,
        artifactType: 'nuclei_template',
        content: artifact.yamlContent,
        filename: `${artifact.templateId}.yaml`,
        language: 'yaml',
        metadata: artifact.metadata,
      }).returning();
      artifactId = inserted.id;
    }

    return {
      success: true,
      data: {
        ...result.data,
        artifact,
        artifactId,
        similarTemplatesUsed: similarTemplates.length,
      },
    };
  }

  private async handleTemplateOptimization(task: TaskDefinition): Promise<TaskResult> {
    const { templateId } = task.parameters;

    // Fetch existing template
    const [template] = await db
      .select()
      .from(nucleiTemplates)
      .where(eq(nucleiTemplates.templateId, templateId))
      .limit(1);

    if (!template) {
      return { success: false, error: `Template ${templateId} not found` };
    }

    // Optimize via AI
    const response = await ollamaAIClient.complete(
      [
        {
          role: 'system',
          content: `You are a Nuclei template optimization expert. Improve the provided template:
- Reduce false positive rate with more specific matchers
- Add extractors to capture useful data (versions, tokens, paths)
- Improve matcher conditions (use AND logic where possible)
- Add negative matchers to exclude known safe patterns
- Output ONLY the optimized YAML, no explanations`,
        },
        {
          role: 'user',
          content: `Optimize this Nuclei template:\n\n${template.content}`,
        },
      ],
      { temperature: 0.2, maxTokens: 4096 }
    );

    let optimizedYaml = response.content || '';
    optimizedYaml = optimizedYaml.replace(/^```(?:yaml)?\n?/m, '').replace(/\n?```\s*$/m, '');

    // Validate the output has required fields
    if (!optimizedYaml.includes('id:') || !optimizedYaml.includes('info:')) {
      return { success: false, error: 'Optimized template missing required fields (id, info)' };
    }

    // Update template in database
    await db
      .update(nucleiTemplates)
      .set({
        content: optimizedYaml,
        updatedAt: new Date(),
        metadata: {
          ...(template.metadata as Record<string, any> || {}),
          optimizedAt: new Date().toISOString(),
          optimizedBy: 'nuclei-template-agent',
        },
      })
      .where(eq(nucleiTemplates.id, template.id));

    return {
      success: true,
      data: {
        templateId,
        optimized: true,
        originalLength: template.content.length,
        optimizedLength: optimizedYaml.length,
      },
    };
  }

  private async findSimilarTemplates(
    service?: string,
    cveId?: string,
  ): Promise<Array<{ name: string; severity: string; content: string }>> {
    if (!service && !cveId) return [];

    try {
      // Search by service name in template name/category
      const searchTerm = service || cveId || '';
      const results = await db
        .select({
          name: nucleiTemplates.name,
          severity: nucleiTemplates.severity,
          content: nucleiTemplates.content,
        })
        .from(nucleiTemplates)
        .where(ilike(nucleiTemplates.name, `%${searchTerm}%`))
        .orderBy(desc(nucleiTemplates.createdAt))
        .limit(3);

      return results;
    } catch {
      return [];
    }
  }
}

export const nucleiTemplateAgent = new NucleiTemplateAgent();
