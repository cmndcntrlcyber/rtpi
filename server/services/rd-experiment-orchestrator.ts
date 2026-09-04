/**
 * R&D Experiment Orchestrator
 * 
 * Orchestrates the execution of R&D experiments across three phases:
 * 1. Research Phase - Deep vulnerability analysis
 * 2. POC Development Phase - Exploit/tool code generation
 * 3. Nuclei Template Phase - Detection template creation
 * 
 * Takes R&D experiments from "planned" status and executes them automatically,
 * delegating to the appropriate agents (research-agent, maldev-agent, rd-team-agent).
 */

import { EventEmitter } from 'events';
import { db } from '../db';
import { rdExperiments, rdArtifacts, researchProjects, vulnerabilities } from '@shared/schema';
import { createKnowledgeArticle } from './knowledge/knowledge-base-writer';
import { eq, and } from 'drizzle-orm';
import { researchAgent } from './agents/research-agent';
import { pocDevelopmentAgent } from './agents/poc-development-agent';
import { nucleiTemplateAgent } from './agents/nuclei-template-agent';
import { createLogger } from '../lib/logger';
const log = createLogger("rd-experiment-orchestrator");

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ExperimentExecutionContext {
  experimentId: string;
  projectId: string;
  vulnerabilityId: string;
  operationId: string;
  targetInfo?: {
    id: string;
    name: string;
    value: string;
    type: string;
  };
}

export interface ResearchArtifact {
  type: 'research_document';
  title: string;
  content: string;
  findings: {
    exploitationVectors: string[];
    prerequisites: string[];
    attackComplexity: 'low' | 'medium' | 'high';
    detectionDifficulty: 'low' | 'medium' | 'high';
    references: string[];
  };
  metadata: {
    cveAnalysis?: string;
    cweMapping?: string;
    attackSurface?: string[];
  };
}

export interface POCArtifact {
  type: 'poc_code';
  language: 'python' | 'ruby' | 'bash' | 'powershell' | 'javascript';
  sourceCode: string;
  filename: string;
  dependencies: string[];
  usage: string;
  reliability: 'high' | 'medium' | 'low';
  evasionTechniques?: string[];
  metadata: {
    targetPlatform: string[];
    payloadType?: string;
    deliveryMethod?: string;
  };
}

export interface NucleiTemplateArtifact {
  type: 'nuclei_template';
  templateId: string;
  yamlContent: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  matchers: Array<{
    type: string;
    condition?: string;
    part?: string;
    words?: string[];
    regex?: string[];
  }>;
  extractors?: Array<{
    type: string;
    part?: string;
    regex?: string[];
    group?: number;
  }>;
  metadata: {
    verified: boolean;
    falsePositiveRate?: number;
  };
}

export type Artifact = ResearchArtifact | POCArtifact | NucleiTemplateArtifact;

export interface ExperimentResult {
  experimentId: string;
  success: boolean;
  artifacts: Artifact[];
  executionLog: string[];
  errors?: string[];
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
}

// ============================================================================
// R&D Experiment Orchestrator
// ============================================================================

class RDExperimentOrchestrator extends EventEmitter {
  private activeExecutions: Map<string, AbortController> = new Map();

  /**
   * Resolve the dispatch type for an experiment. Prefers the explicit `type`
   * column; for legacy rows (or unrecognized values) falls back to inferring
   * from the experiment name so older experiments keep working.
   */
  private resolveExperimentType(experiment: { type?: string | null; name: string }): string {
    const known = ['vulnerability_research', 'poc_development', 'nuclei_template'];
    if (experiment.type && known.includes(experiment.type)) {
      return experiment.type;
    }

    const name = experiment.name.toLowerCase();
    if (name.includes('research') || name.includes('cve')) return 'vulnerability_research';
    if (name.includes('poc') || name.includes('exploit')) return 'poc_development';
    if (name.includes('nuclei') || name.includes('template')) return 'nuclei_template';

    // Default to research rather than failing — matches the new column default.
    return 'vulnerability_research';
  }

  /**
   * Execute a complete R&D experiment (all phases)
   */
  async executeExperiment(
    experimentId: string,
    context: ExperimentExecutionContext
  ): Promise<ExperimentResult> {
    const startTime = Date.now();
    const executionLog: string[] = [];
    const artifacts: Artifact[] = [];
    const errors: string[] = [];

    // Check if already executing
    if (this.activeExecutions.has(experimentId)) {
      throw new Error(`Experiment ${experimentId} is already executing`);
    }

    const abortController = new AbortController();
    this.activeExecutions.set(experimentId, abortController);

    try {
      executionLog.push(`[${new Date().toISOString()}] Starting experiment execution`);

      // Update experiment status to 'running'
      await db
        .update(rdExperiments)
        .set({
          status: 'running',
          startedAt: new Date(),
        })
        .where(eq(rdExperiments.id, experimentId));

      this.emit('experiment_started', { experimentId, context });

      // Fetch experiment details
      const [experiment] = await db
        .select()
        .from(rdExperiments)
        .where(eq(rdExperiments.id, experimentId));

      if (!experiment) {
        throw new Error(`Experiment ${experimentId} not found`);
      }

      // Determine experiment type. Prefer the explicit `type` column; fall back to
      // name-keyword inference only for legacy rows created before the column existed.
      const experimentType = this.resolveExperimentType(experiment);
      executionLog.push(`Resolved experiment type: ${experimentType}`);
      let artifact: Artifact | null = null;

      // Guard the empty-vulnerabilityId case BEFORE any phase runs. All three
      // phases fetch `vulnerabilities` by id; with an empty string the query
      // becomes `WHERE id = ''`, which Postgres rejects as an invalid UUID cast
      // and throws an opaque DB error. A project created in the UI has no
      // sourceVulnerabilityId by default, so this is the common failure path —
      // fail it early with an actionable message instead.
      if (!context.vulnerabilityId || context.vulnerabilityId.trim() === '') {
        throw new Error(
          'This research project has no source vulnerability. Set a source vulnerability ' +
            'on the project before executing experiments (research requires a target CVE/service).'
        );
      }

      const signal = abortController.signal;
      if (experimentType === 'vulnerability_research') {
        executionLog.push('Executing Research Phase...');
        artifact = await this.executeResearchPhase(experiment, context, executionLog, signal);
      } else if (experimentType === 'poc_development') {
        executionLog.push('Executing POC Development Phase...');
        artifact = await this.executePOCPhase(experiment, context, executionLog, signal);
      } else if (experimentType === 'nuclei_template') {
        executionLog.push('Executing Nuclei Template Phase...');
        artifact = await this.executeNucleiPhase(experiment, context, executionLog, signal);
      } else {
        throw new Error(`Unknown experiment type: ${experimentType}`);
      }

      // If cancelled while the phase was running, stop before persisting results.
      if (signal.aborted) {
        throw new Error('Experiment cancelled');
      }

      if (artifact) {
        artifacts.push(artifact);
        executionLog.push(`Generated artifact: ${artifact.type}`);

        // Persist artifact to rd_artifacts table
        await this.persistArtifact(artifact, experimentId, context.projectId);
        executionLog.push(`Persisted artifact to database`);
      }

      // Update experiment with results
      await db
        .update(rdExperiments)
        .set({
          status: 'completed',
          completedAt: new Date(),
          results: {
            artifacts: artifacts.map(a => ({ type: a.type })),
            executionLog,
          },
        })
        .where(eq(rdExperiments.id, experimentId));

      executionLog.push(`[${new Date().toISOString()}] Experiment completed successfully`);

      const result: ExperimentResult = {
        experimentId,
        success: true,
        artifacts,
        executionLog,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      };

      this.emit('experiment_completed', result);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMsg);
      executionLog.push(`[ERROR] ${errorMsg}`);

      // If this experiment was cancelled, cancelExperiment() already set the row to
      // 'cancelled'. Don't overwrite that with 'failed' — just record the log/errors.
      const wasCancelled = abortController.signal.aborted;
      await db
        .update(rdExperiments)
        .set({
          status: wasCancelled ? 'cancelled' : 'failed',
          completedAt: new Date(),
          errorMessage: errorMsg,
          results: { executionLog, errors },
        })
        .where(eq(rdExperiments.id, experimentId));

      this.emit(wasCancelled ? 'experiment_cancelled' : 'experiment_failed', {
        experimentId,
        error: errorMsg,
      });

      return {
        experimentId,
        success: false,
        artifacts,
        executionLog,
        errors,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.activeExecutions.delete(experimentId);
    }
  }

  /**
   * Execute Research Phase - Deep vulnerability analysis
   */
  private async executeResearchPhase(
    experiment: any,
    context: ExperimentExecutionContext,
    log: string[],
    signal?: AbortSignal
  ): Promise<ResearchArtifact> {
    log.push('Delegating to Research Agent for vulnerability analysis...');

    // Ensure agent is initialized
    if (!researchAgent.isInitialized) {
      await researchAgent.initialize();
    }

    // Fetch vulnerability details
    const [vuln] = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.id, context.vulnerabilityId));

    if (!vuln) {
      throw new Error(`Vulnerability ${context.vulnerabilityId} not found`);
    }

    // Execute research task
    const result = await researchAgent.executeTask({
      taskType: 'vulnerability_research',
      taskName: `Deep Research: ${vuln.title}`,
      description: experiment.description,
      operationId: context.operationId,
      signal,
      parameters: {
        vulnerabilityId: context.vulnerabilityId,
        cveId: vuln.cveId,
        service: vuln.title.split(' ')[0], // Extract service name
        targetInfo: context.targetInfo,
      },
    });

    if (!result.success) {
      throw new Error(`Research phase failed: ${result.error}`);
    }

    log.push('Research phase completed successfully');

    // Transform agent result into ResearchArtifact
    const researchPackage = result.data?.researchPackage;

    // Output-quality gate: if the research produced no CVEs and no exploits, the
    // resulting artifact would be effectively blank (a common symptom of a missing
    // TAVILY_API_KEY). Fail the experiment instead of persisting an empty artifact
    // as a successful result.
    const cveCount = researchPackage?.cves?.length || 0;
    const exploitCount = researchPackage?.exploits?.length || 0;
    if (cveCount === 0 && exploitCount === 0) {
      const reason =
        'Research phase produced no CVEs or exploits — empty research package. ' +
        'Verify TAVILY_API_KEY is configured and the target service/CVE is resolvable.';
      log.push(`[ERROR] ${reason}`);
      throw new Error(reason);
    }

    const artifact: ResearchArtifact = {
      type: 'research_document',
      title: `Vulnerability Research: ${vuln.title}`,
      content: JSON.stringify(researchPackage, null, 2),
      findings: {
        exploitationVectors: researchPackage?.methodology?.steps || [],
        prerequisites: researchPackage?.methodology?.prerequisites || [],
        attackComplexity: researchPackage?.methodology?.riskLevel === 'critical' ? 'low' : 'medium',
        detectionDifficulty: 'medium',
        references: researchPackage?.exploits?.map((e: any) => e.url) || [],
      },
      metadata: {
        cveAnalysis: researchPackage?.cves?.map((c: any) => c.id).join(', '),
        attackSurface: researchPackage?.exploits?.map((e: any) => e.type) || [],
      },
    };

    return artifact;
  }

  /**
   * Execute POC Development Phase - Generate exploit code
   */
  private async executePOCPhase(
    experiment: any,
    context: ExperimentExecutionContext,
    log: string[],
    signal?: AbortSignal
  ): Promise<POCArtifact> {
    log.push('Delegating to POC Development Agent...');

    if (!pocDevelopmentAgent.isInitialized) {
      await pocDevelopmentAgent.initialize();
    }

    // Fetch vulnerability for research context
    const [vuln] = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.id, context.vulnerabilityId));

    if (!vuln) {
      throw new Error(`Vulnerability ${context.vulnerabilityId} not found`);
    }

    // Build research package from vulnerability data
    const researchPackage = {
      vulnerabilityId: context.vulnerabilityId,
      operationId: context.operationId,
      cves: vuln.cveId ? [{ id: vuln.cveId, description: vuln.description, severity: vuln.severity }] : [],
      exploits: [],
      methodology: {
        attackVector: 'network',
        prerequisites: [],
        steps: [],
        recommendedApproach: experiment.methodology || 'Generate custom exploit',
        riskLevel: vuln.severity,
        evasionNotes: [],
      },
      service: vuln.title.split(' ')[0],
      researchTimestamp: new Date().toISOString(),
      tavilyQueries: [],
      totalSources: 0,
    };

    // Execute POC development via dedicated agent
    const result = await pocDevelopmentAgent.executeTask({
      taskType: 'poc_generation',
      taskName: experiment.name,
      description: experiment.description,
      operationId: context.operationId,
      signal,
      parameters: {
        researchPackage,
        vulnerabilityId: context.vulnerabilityId,
        projectId: context.projectId,
        experimentId: context.experimentId,
      },
    });

    if (!result.success) {
      throw new Error(`POC development failed: ${result.error}`);
    }

    log.push('POC development completed successfully');

    // Use artifact from agent if available, otherwise build from result
    const agentArtifact = result.data?.artifact;
    const artifact: POCArtifact = agentArtifact || {
      type: 'poc_code',
      language: 'ruby',
      sourceCode: result.data?.artifact?.content || '',
      filename: result.data?.artifact?.modulePath || 'exploit.rb',
      dependencies: ['metasploit-framework'],
      usage: `msfconsole -q -x "use ${result.data?.artifact?.modulePath}; set RHOSTS <target>; exploit"`,
      reliability: 'medium',
      metadata: {
        targetPlatform: ['linux', 'windows'],
      },
    };

    return artifact;
  }

  /**
   * Execute Nuclei Template Phase - Generate detection template
   */
  private async executeNucleiPhase(
    experiment: any,
    context: ExperimentExecutionContext,
    log: string[],
    signal?: AbortSignal
  ): Promise<NucleiTemplateArtifact> {
    log.push('Delegating to Nuclei Template Agent...');

    if (!nucleiTemplateAgent.isInitialized) {
      await nucleiTemplateAgent.initialize();
    }

    // Fetch vulnerability
    const [vuln] = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.id, context.vulnerabilityId));

    if (!vuln) {
      throw new Error(`Vulnerability ${context.vulnerabilityId} not found`);
    }

    // Execute template generation via dedicated agent
    const result = await nucleiTemplateAgent.executeTask({
      taskType: 'template_generation',
      taskName: experiment.name,
      description: experiment.description,
      operationId: context.operationId,
      signal,
      parameters: {
        vulnerabilityId: context.vulnerabilityId,
        cveId: vuln.cveId,
        title: vuln.title,
        description: vuln.description,
        severity: vuln.severity,
        service: vuln.title.split(' ')[0],
        projectId: context.projectId,
        experimentId: context.experimentId,
      },
    });

    if (!result.success) {
      throw new Error(`Nuclei template generation failed: ${result.error}`);
    }

    log.push('Nuclei template generated successfully');

    // Use artifact from agent if available
    const agentArtifact = result.data?.artifact;
    const artifact: NucleiTemplateArtifact = agentArtifact || {
      type: 'nuclei_template',
      templateId: result.data?.templateId || `custom-${context.vulnerabilityId.substring(0, 8)}`,
      yamlContent: result.data?.template || result.data?.yamlContent || '',
      severity: vuln.severity as any,
      matchers: result.data?.matchers || [],
      extractors: result.data?.extractors,
      metadata: {
        verified: false,
        falsePositiveRate: undefined,
      },
    };

    return artifact;
  }

  /**
   * Persist an artifact to the rd_artifacts table
   */
  private async persistArtifact(
    artifact: Artifact,
    experimentId: string,
    projectId: string
  ): Promise<string> {
    let content: string;
    let filename: string | undefined;
    let language: string | undefined;

    if (artifact.type === 'research_document') {
      content = artifact.content;
      filename = `research-${experimentId.substring(0, 8)}.json`;
      language = undefined;
    } else if (artifact.type === 'poc_code') {
      content = artifact.sourceCode;
      filename = artifact.filename;
      language = artifact.language;
    } else {
      content = artifact.yamlContent;
      filename = `${artifact.templateId}.yaml`;
      language = 'yaml';
    }

    const [inserted] = await db.insert(rdArtifacts).values({
      experimentId,
      projectId,
      artifactType: artifact.type,
      content,
      filename,
      language,
      metadata: artifact.metadata,
    }).returning();

    // S1 — auto-index research findings into the Knowledge Base so they become
    // searchable context for future experiments (instead of a dead JSON blob in
    // rd_artifacts). Best-effort + idempotent (deduped by `artifact:<id>`);
    // never let a KB failure break artifact persistence.
    if (artifact.type === 'research_document') {
      try {
        const cves = artifact.metadata?.cveAnalysis;
        await createKnowledgeArticle({
          title: artifact.title,
          content: artifact.content,
          summary: cves ? `Research findings — CVEs: ${cves}` : 'Automated R&D research findings',
          category: 'research_finding',
          contentType: 'technique',
          tags: [
            'source:rd-research',
            `experiment:${experimentId}`,
            ...(artifact.metadata?.attackSurface ?? []).map((s) => `surface:${s}`),
          ],
          relatedProjectId: projectId,
          dedupeTag: `artifact:${inserted.id}`,
        });
      } catch (err) {
        log.warn('[orchestrator] S1 KB indexing failed (non-fatal):', err);
      }
    }

    return inserted.id;
  }

  /**
   * Execute all experiments for a research project sequentially
   */
  async executeProject(projectId: string): Promise<{
    projectId: string;
    totalExperiments: number;
    completed: number;
    failed: number;
    results: ExperimentResult[];
  }> {
    // Fetch all experiments for this project
    const experiments = await db
      .select()
      .from(rdExperiments)
      .where(eq(rdExperiments.projectId, projectId))
      .orderBy(rdExperiments.createdAt);

    const results: ExperimentResult[] = [];
    let completed = 0;
    let failed = 0;

    // Fetch project details for context
    const [project] = await db
      .select()
      .from(researchProjects)
      .where(eq(researchProjects.id, projectId));

    if (!project) {
      throw new Error(`Research project ${projectId} not found`);
    }

    const context: ExperimentExecutionContext = {
      experimentId: '', // Set per experiment
      projectId,
      vulnerabilityId: project.sourceVulnerabilityId || '',
      operationId: '', // TODO: Get from project or vulnerability
    };

    // Execute experiments sequentially
    for (const experiment of experiments) {
      if (experiment.status !== 'planned') {
        continue; // Skip already executed experiments
      }

      context.experimentId = experiment.id;

      try {
        const result = await this.executeExperiment(experiment.id, context);
        results.push(result);

        if (result.success) {
          completed++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        log.error(`Failed to execute experiment ${experiment.id}:`, error);
      }
    }

    // Update project status. Guard the zero-experiment case: with no
    // experiments the loop runs zero times, so `0 + 0 === 0` would otherwise
    // mark a brand-new empty project 'completed' the instant "Execute All" is
    // clicked (N5). Only conclude a project that actually had experiments.
    const allComplete = experiments.length > 0 && completed + failed === experiments.length;
    if (allComplete) {
      await db
        .update(researchProjects)
        .set({
          status: failed === 0 ? 'completed' : 'active',
          completedAt: failed === 0 ? new Date() : undefined,
        })
        .where(eq(researchProjects.id, projectId));
    }

    return {
      projectId,
      totalExperiments: experiments.length,
      completed,
      failed,
      results,
    };
  }

  /**
   * Cancel an actively running experiment
   */
  async cancelExperiment(experimentId: string): Promise<boolean> {
    const controller = this.activeExecutions.get(experimentId);
    if (!controller) {
      return false;
    }

    controller.abort();
    this.activeExecutions.delete(experimentId);

    await db
      .update(rdExperiments)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
      })
      .where(eq(rdExperiments.id, experimentId));

    return true;
  }

  /**
   * Get execution status
   */
  isExecuting(experimentId: string): boolean {
    return this.activeExecutions.has(experimentId);
  }

  get activeExecutionCount(): number {
    return this.activeExecutions.size;
  }
}

// Singleton instance
export const rdExperimentOrchestrator = new RDExperimentOrchestrator();
