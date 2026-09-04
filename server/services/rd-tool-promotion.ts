/**
 * R&D Tool Promotion Service
 * 
 * Automatically promotes R&D POC artifacts to the Tool Registry
 * with full metadata extraction and ATT&CK mapping.
 * 
 * Enables R&D-generated exploits to become operational tools
 * discoverable through the Tool Registry and usable in workflows.
 */

import { db } from '../db';
import { toolRegistry, toolRegistryTactics, toolRegistryTechniques, attackTactics, attackTechniques, vulnerabilities, rdArtifacts, researchProjects, nucleiTemplates } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { POCArtifact } from './rd-experiment-orchestrator';
import { createKnowledgeArticle } from './knowledge/knowledge-base-writer';
import { createLogger } from '../lib/logger';
const log = createLogger("rd-tool-promotion");

// ============================================================================
// Types
// ============================================================================

export interface ToolPromotionRequest {
  artifactId: string;
  toolName?: string;
  category?: string;
  overrideMetadata?: Record<string, any>;
}

export interface ToolPromotionResult {
  success: boolean;
  toolId?: string;
  toolRegistryId?: string;
  error?: string;
  metadata: {
    artifactId: string;
    extractedMetadata: Record<string, any>;
    attackMappings: {
      tactics: string[];
      techniques: string[];
    };
  };
}

// ============================================================================
// R&D Tool Promotion Service
// ============================================================================

class RDToolPromotion {
  /**
   * Promote a POC artifact to the Tool Registry
   */
  async promoteToToolRegistry(
    artifactId: string,
    toolName?: string,
    category?: string
  ): Promise<ToolPromotionResult> {
    try {
      // Fetch the artifact from rd_artifacts table
      const artifact = await this.fetchArtifact(artifactId);
      
      if (!artifact) {
        return this.failureResult(artifactId, `Artifact ${artifactId} not found`);
      }

      if (artifact.artifactType !== 'poc_code') {
        return this.failureResult(artifactId, `Can only promote poc_code artifacts. Got: ${artifact.artifactType}`);
      }

      // Extract metadata from POC artifact
      const pocMetadata = artifact.metadata as POCArtifact;
      const extractedMetadata = this.extractToolMetadata(artifact, pocMetadata);

      // Determine tool category
      const toolCategory = category || this.inferCategory(pocMetadata, artifact.filename || '');

      // Generate unique tool ID
      const toolId = this.generateToolId(toolName || artifact.filename || 'custom-rd-tool');

      // Create Tool Registry entry
      const [tool] = await db.insert(toolRegistry).values({
        toolId,
        name: toolName || artifact.filename || 'Custom R&D Tool',
        category: toolCategory as any,
        description: `R&D-generated tool from experiment ${artifact.experimentId}`,
        binaryPath: `/opt/rd-tools/${artifact.filename}`,
        containerName: 'rtpi-tools',
        containerUser: 'rtpi-tools',
        installMethod: 'manual',
        installStatus: 'pending',
        validationStatus: 'untested',
        tags: ['r&d-generated', ...(pocMetadata.evasionTechniques || [])],
      } as any).returning();

      // Auto-assign ATT&CK mappings
      const attackMappings = await this.assignATTACKMapping(tool.id, artifact);

      // Link artifact to tool
      await this.linkArtifactToTool(artifactId, tool.id);

      // S4 — index the promoted tool into the Knowledge Base as a tool_doc so
      // it's discoverable by R&D agents at experiment time (pairs with S2).
      // Best-effort + idempotent (deduped by `tool:<id>`); never fail the
      // promotion on a KB hiccup.
      try {
        const em = extractedMetadata;
        const docLines = [
          `# ${tool.name}`,
          '',
          em.usage ? String(em.usage) : '',
          '',
          em.language ? `**Language:** ${em.language}` : '',
          em.targetPlatform ? `**Target platform:** ${em.targetPlatform}` : '',
          em.reliability ? `**Reliability:** ${em.reliability}` : '',
          Array.isArray(em.dependencies) && em.dependencies.length
            ? `**Dependencies:** ${em.dependencies.join(', ')}`
            : '',
          Array.isArray(em.evasionTechniques) && em.evasionTechniques.length
            ? `**Evasion:** ${em.evasionTechniques.join(', ')}`
            : '',
        ].filter(Boolean);
        await createKnowledgeArticle({
          title: tool.name,
          content: docLines.join('\n'),
          summary: `Promoted R&D tool${em.language ? ` (${em.language})` : ''} — category ${toolCategory}.`,
          category: 'promoted_tool',
          contentType: 'tool_doc',
          tags: ['source:rd-tool', `tool_id:${tool.toolId}`],
          attackTactics: attackMappings.tactics,
          attackTechniques: attackMappings.techniques,
          relatedProjectId: artifact.projectId ?? null,
          dedupeTag: `tool:${tool.id}`,
        });
      } catch (err) {
        log.warn('[rd-tool-promotion] S4 KB indexing failed (non-fatal):', err);
      }

      return {
        success: true,
        toolId: tool.toolId,
        toolRegistryId: tool.id,
        metadata: {
          artifactId,
          extractedMetadata,
          attackMappings,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return this.failureResult(artifactId, errorMsg);
    }
  }

  /**
   * S6 — promote a nuclei_template artifact into the active nuclei_templates
   * registry so it's usable by the scan pipeline. The third artifact type
   * (research/poc had promotion paths; nuclei did not). Idempotent on the
   * unique templateId. Severity/category are parsed from the YAML since the
   * persisted artifact metadata doesn't carry them.
   *
   * NOTE: this registers the template in the DB (the durable, testable step).
   * Writing the YAML into a running nuclei container's templates dir is a
   * separate deploy step that requires a live container; `filePath` records
   * the intended location for that follow-up.
   */
  async promoteToNucleiTemplates(
    artifactId: string,
    name?: string,
  ): Promise<{ success: boolean; templateId?: string; nucleiTemplateId?: string; alreadyExists?: boolean; error?: string }> {
    try {
      const artifact = await this.fetchArtifact(artifactId);
      if (!artifact) return { success: false, error: `Artifact ${artifactId} not found` };
      if (artifact.artifactType !== 'nuclei_template') {
        return { success: false, error: `Can only deploy nuclei_template artifacts. Got: ${artifact.artifactType}` };
      }

      const yaml: string = artifact.content || '';
      const templateId =
        (artifact.filename || '').replace(/\.ya?ml$/i, '') ||
        `rd-template-${Date.now().toString(36)}`;

      const sevMatch = yaml.match(/severity:\s*([a-z]+)/i)?.[1]?.toLowerCase();
      const validSevs = ['critical', 'high', 'medium', 'low', 'informational'];
      const severity = (sevMatch && validSevs.includes(sevMatch) ? sevMatch : 'medium') as
        'critical' | 'high' | 'medium' | 'low' | 'informational';

      const category =
        yaml.match(/tags:\s*([a-z0-9,\-\s]+)/i)?.[1]?.split(',')[0]?.trim() || undefined;

      // Idempotent: templateId is unique.
      const [existing] = await db
        .select({ id: nucleiTemplates.id })
        .from(nucleiTemplates)
        .where(eq(nucleiTemplates.templateId, templateId))
        .limit(1);
      if (existing) {
        return { success: true, templateId, nucleiTemplateId: existing.id, alreadyExists: true };
      }

      const targetVulnerabilityId = await this.getVulnerabilityIdFromArtifact(artifact);

      const [row] = await db
        .insert(nucleiTemplates)
        .values({
          templateId,
          name: name || templateId,
          severity,
          category,
          content: yaml,
          filePath: `/opt/nuclei-templates/custom/${templateId}.yaml`,
          isCustom: true,
          generatedByAi: true,
          targetVulnerabilityId: targetVulnerabilityId || null,
          tags: ['r&d-generated'],
        } as any)
        .returning({ id: nucleiTemplates.id });

      return { success: true, templateId, nucleiTemplateId: row.id };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Fetch artifact from database
   */
  private async fetchArtifact(artifactId: string): Promise<any> {
    const [result] = await db
      .select()
      .from(rdArtifacts)
      .where(eq(rdArtifacts.id, artifactId))
      .limit(1);
    return result || null;
  }

  /**
   * Extract tool metadata from POC artifact
   */
  private extractToolMetadata(
    artifact: any,
    pocMetadata: POCArtifact
  ): Record<string, any> {
    return {
      language: pocMetadata.language,
      targetPlatform: pocMetadata.metadata.targetPlatform,
      reliability: pocMetadata.reliability,
      dependencies: pocMetadata.dependencies,
      usage: pocMetadata.usage,
      evasionTechniques: pocMetadata.evasionTechniques || [],
      payloadType: pocMetadata.metadata.payloadType,
      deliveryMethod: pocMetadata.metadata.deliveryMethod,
    };
  }

  /**
   * Infer tool category from metadata
   */
  private inferCategory(pocMetadata: POCArtifact, filename: string): string {
    const combinedText = `${filename} ${JSON.stringify(pocMetadata.metadata)}`.toLowerCase();

    if (/sql|sqli/i.test(combinedText)) return 'exploitation';
    if (/xss|cross-site/i.test(combinedText)) return 'web-application';
    if (/rce|remote.*code/i.test(combinedText)) return 'exploitation';
    if (/scanner|detect/i.test(combinedText)) return 'scanning';
    if (/password|crack/i.test(combinedText)) return 'password-cracking';
    if (/post.*exploit/i.test(combinedText)) return 'post-exploitation';

    return 'exploitation'; // Default
  }

  /**
   * Generate unique tool ID
   */
  private generateToolId(baseName: string): string {
    const base = baseName
      .replace(/\.[^.]+$/, '')  // Remove extension
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')  // Sanitize
      .replace(/-+/g, '-')  // Collapse multiple dashes
      .replace(/^-|-$/g, '');  // Trim dashes

    const timestamp = Date.now().toString(36);
    return `rd-${base}-${timestamp}`;
  }

  /**
   * Auto-assign ATT&CK tactic and technique mappings
   */
  private async assignATTACKMapping(
    toolRegistryId: string,
    artifact: any
  ): Promise<{ tactics: string[]; techniques: string[] }> {
    // Get vulnerability associated with this artifact's experiment
    const vulnerabilityId = await this.getVulnerabilityIdFromArtifact(artifact);
    
    if (!vulnerabilityId) {
      return { tactics: [], techniques: [] };
    }

    const [vuln] = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.id, vulnerabilityId));

    if (!vuln) {
      return { tactics: [], techniques: [] };
    }

    // Infer ATT&CK mappings from vulnerability type
    const mappings = this.inferATTACKMappings(vuln);

    // Assign tactics
    await this.assignTactics(toolRegistryId, mappings.tacticNames);

    // Assign techniques  
    await this.assignTechniques(toolRegistryId, mappings.techniqueIds);

    return {
      tactics: mappings.tacticNames,
      techniques: mappings.techniqueIds,
    };
  }

  /**
   * Get vulnerability ID from artifact's experiment/project chain
   */
  private async getVulnerabilityIdFromArtifact(artifact: any): Promise<string | null> {
    // Get project from artifact (Drizzle returns camelCase: projectId, not project_id)
    if (!artifact?.projectId) {
      return null;
    }
    const [project] = await db
      .select()
      .from(researchProjects)
      .where(eq(researchProjects.id, artifact.projectId))
      .limit(1);

    return project?.sourceVulnerabilityId || null;
  }

  /**
   * Infer ATT&CK tactics and techniques from vulnerability
   */
  private inferATTACKMappings(vuln: any): {
    tacticNames: string[];
    techniqueIds: string[];
  } {
    const title = vuln.title.toLowerCase();
    const description = (vuln.description || '').toLowerCase();
    const combined = `${title} ${description}`;

    const tacticNames: string[] = [];
    const techniqueIds: string[] = [];

    // Initial Access
    if (/exploit|vulnerability|rce|injection/i.test(combined)) {
      tacticNames.push('Initial Access');
      techniqueIds.push('T1190'); // Exploit Public-Facing Application
    }

    // Execution
    if (/rce|command.*inject|code.*exec/i.test(combined)) {
      if (!tacticNames.includes('Execution')) tacticNames.push('Execution');
      techniqueIds.push('T1059'); // Command and Scripting Interpreter
    }

    // Credential Access
    if (/password|credential|auth.*bypass/i.test(combined)) {
      tacticNames.push('Credential Access');
      techniqueIds.push('T1110'); // Brute Force
    }

    // Discovery
    if (/discover|enumerate|scan/i.test(combined)) {
      tacticNames.push('Discovery');
      techniqueIds.push('T1046'); // Network Service Scanning
    }

    // Reconnaissance (default fallback)
    if (tacticNames.length === 0) {
      tacticNames.push('Reconnaissance');
      techniqueIds.push('T1595'); // Active Scanning
    }

    return { tacticNames, techniqueIds };
  }

  /**
   * Assign tactics to tool
   */
  private async assignTactics(toolRegistryId: string, tacticNames: string[]): Promise<void> {
    for (const tacticName of tacticNames) {
      const [tactic] = await db
        .select()
        .from(attackTactics)
        .where(eq(attackTactics.name, tacticName))
        .limit(1);

      if (tactic) {
        // Check if mapping already exists
        const existing = await db
          .select()
          .from(toolRegistryTactics)
          .where(
            and(
              eq(toolRegistryTactics.toolId, toolRegistryId),
              eq(toolRegistryTactics.tacticId, tactic.id)
            )
          );

        if (existing.length === 0) {
          await db.insert(toolRegistryTactics).values({
            toolId: toolRegistryId,
            tacticId: tactic.id,
            createdAt: new Date(),
          } as any);
        }
      }
    }
  }

  /**
   * Assign techniques to tool
   */
  private async assignTechniques(toolRegistryId: string, techniqueIds: string[]): Promise<void> {
    for (const attackId of techniqueIds) {
      const [technique] = await db
        .select()
        .from(attackTechniques)
        .where(eq(attackTechniques.attackId, attackId))
        .limit(1);

      if (technique) {
        // Check if mapping already exists
        const existing = await db
          .select()
          .from(toolRegistryTechniques)
          .where(
            and(
              eq(toolRegistryTechniques.toolId, toolRegistryId),
              eq(toolRegistryTechniques.techniqueId, technique.id)
            )
          );

        if (existing.length === 0) {
          await db.insert(toolRegistryTechniques).values({
            toolId: toolRegistryId,
            techniqueId: technique.id,
            createdAt: new Date(),
          } as any);
        }
      }
    }
  }

  /**
   * Link artifact to promoted tool
   */
  private async linkArtifactToTool(artifactId: string, toolId: string): Promise<void> {
    // Update tool_registry.rd_artifact_id
    await db
      .update(toolRegistry)
      .set({ rdArtifactId: artifactId } as any)
      .where(eq(toolRegistry.id, toolId));
  }

  /**
   * Helper: Create failure result
   */
  private failureResult(artifactId: string, error: string): ToolPromotionResult {
    return {
      success: false,
      error,
      metadata: {
        artifactId,
        extractedMetadata: {},
        attackMappings: { tactics: [], techniques: [] },
      },
    };
  }
}

// Singleton instance
export const rdToolPromotion = new RDToolPromotion();
