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
import { eq, and } from 'drizzle-orm';
import { researchAgent } from './agents/research-agent';
import { pocDevelopmentAgent } from './agents/poc-development-agent';
import { nucleiTemplateAgent } from './agents/nuclei-template-agent';

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

      // Determine experiment type based on name pattern
      const experimentName = experiment.name.toLowerCase();
      let artifact: Artifact | null = null;

      if (experimentName.includes('research') || experimentName.includes('cve')) {
        executionLog.push('Executing Research Phase...');
        artifact = await this.executeResearchPhase(experiment, context, executionLog);
      } else if (experimentName.includes('poc') || experimentName.includes('exploit')) {
        executionLog.push('Executing POC Development Phase...');
        artifact = await this.executePOCPhase(experiment, context, executionLog);
      } else if (experimentName.includes('nuclei') || experimentName.includes('template')) {
        executionLog.push('Executing Nuclei Template Phase...');
        artifact = await this.executeNucleiPhase(experiment, context, executionLog);
      } else {
        throw new Error(`Unknown experiment type: ${experiment.name}`);
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

      // Update experiment status to failed
      await db
        .update(rdExperiments)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorMessage: errorMsg,
          results: { executionLog, errors },
        })
        .where(eq(rdExperiments.id, experimentId));

      this.emit('experiment_failed', { experimentId, error: errorMsg });

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
    log: string[]
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
    log: string[]
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
    log: string[]
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
        console.error(`Failed to execute experiment ${experiment.id}:`, error);
      }
    }

    // Update project status
    const allComplete = completed + failed === experiments.length;
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
