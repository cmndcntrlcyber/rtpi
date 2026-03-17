/**
 * POC Development Agent (v2.4 Phase 3)
 *
 * Generates proof-of-concept exploit code from R&D research artifacts.
 * Supports multi-language output (Ruby/MSF, Python, Bash) and persists
 * artifacts to the rdArtifacts table.
 *
 * Delegates MSF module generation to maldevAgent; handles Python/Bash
 * PoC scripts directly via ollamaAIClient.
 */

import { BaseTaskAgent, TaskDefinition, TaskResult } from './base-task-agent';
import { db } from '../../db';
import { rdArtifacts } from '@shared/schema';
import { maldevAgent } from './maldev-agent';
import { ollamaAIClient } from '../ollama-ai-client';
import type { ResearchArtifact, POCArtifact } from '../rd-experiment-orchestrator';

// ============================================================================
// POC Development Agent
// ============================================================================

class PocDevelopmentAgent extends BaseTaskAgent {
  constructor() {
    super(
      'POC Development Agent',
      'poc_developer',
      ['poc_generation', 'multi_language_poc']
    );
  }

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    await this.updateStatus('running');

    try {
      switch (task.taskType) {
        case 'poc_generation':
          return await this.handlePocGeneration(task);
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

  private async handlePocGeneration(task: TaskDefinition): Promise<TaskResult> {
    const {
      researchArtifact,
      vulnerabilityId,
      operationId,
      projectId,
      experimentId,
      language: requestedLanguage,
      researchPackage,
    } = task.parameters;

    // Determine language
    const language = requestedLanguage || this.inferLanguage(researchArtifact, researchPackage);

    let artifact: POCArtifact;

    if (language === 'ruby') {
      // Delegate to maldev-agent for MSF module generation
      const result = await this.delegateToMaldev(task, researchPackage);
      if (!result.success) return result;

      artifact = {
        type: 'poc_code',
        language: 'ruby',
        sourceCode: result.data?.artifact?.content || '',
        filename: result.data?.artifact?.modulePath || 'exploit.rb',
        dependencies: ['metasploit-framework'],
        usage: `msfconsole -q -x "use ${result.data?.artifact?.modulePath}; set RHOSTS <target>; exploit"`,
        reliability: 'medium',
        metadata: { targetPlatform: ['linux', 'windows'] },
      };
    } else {
      // Generate standalone PoC via AI
      artifact = await this.generateStandalonePoc(
        language as 'python' | 'bash',
        researchArtifact,
        researchPackage,
        vulnerabilityId,
      );
    }

    // Persist to rdArtifacts
    let artifactId: string | undefined;
    if (experimentId && projectId) {
      const [inserted] = await db.insert(rdArtifacts).values({
        experimentId,
        projectId,
        artifactType: 'poc_code',
        content: artifact.sourceCode,
        filename: artifact.filename,
        language: artifact.language,
        metadata: artifact.metadata,
      }).returning();
      artifactId = inserted.id;
    }

    return {
      success: true,
      data: { artifact, artifactId, language },
    };
  }

  private async delegateToMaldev(task: TaskDefinition, researchPackage: any): Promise<TaskResult> {
    if (!maldevAgent.isInitialized) {
      await maldevAgent.initialize();
    }

    return maldevAgent.executeTask({
      taskType: 'module_crafting',
      taskName: task.taskName,
      description: task.description,
      operationId: task.parameters.operationId,
      parameters: {
        researchPackage,
        useToolIntegration: true,
      },
    });
  }

  private async generateStandalonePoc(
    language: 'python' | 'bash',
    researchArtifact?: ResearchArtifact,
    researchPackage?: any,
    vulnerabilityId?: string,
  ): Promise<POCArtifact> {
    const findings = researchArtifact?.findings;
    const methodology = researchPackage?.methodology;

    const systemPrompt = language === 'python'
      ? `You are a security researcher writing Python proof-of-concept exploit scripts.
Generate a complete, runnable Python script. Requirements:
- Include shebang (#!/usr/bin/env python3)
- Use argparse for target parameters (--target, --port)
- Use requests/socket as appropriate
- Include clear error handling and output
- Output ONLY the Python code, no markdown fences or explanations`
      : `You are a security researcher writing Bash proof-of-concept exploit scripts.
Generate a complete, runnable Bash script. Requirements:
- Include shebang (#!/usr/bin/env bash)
- Accept target/port as arguments ($1, $2)
- Use curl/netcat/nmap as appropriate
- Include proper quoting and error handling
- Output ONLY the Bash code, no markdown fences or explanations`;

    const context = [
      findings?.exploitationVectors?.length ? `Exploitation Vectors: ${findings.exploitationVectors.join('; ')}` : null,
      findings?.prerequisites?.length ? `Prerequisites: ${findings.prerequisites.join('; ')}` : null,
      findings?.attackComplexity ? `Attack Complexity: ${findings.attackComplexity}` : null,
      methodology?.attackVector ? `Attack Vector: ${methodology.attackVector}` : null,
      methodology?.steps?.length ? `Steps: ${methodology.steps.join('; ')}` : null,
      methodology?.payloadType ? `Payload Type: ${methodology.payloadType}` : null,
    ].filter(Boolean).join('\n');

    const userPrompt = `Generate a ${language} proof-of-concept exploit script for the following vulnerability:

${researchArtifact?.title || 'Vulnerability PoC'}

${context || 'Generate a generic network exploitation PoC.'}

The script should demonstrate the vulnerability and provide clear output about success/failure.`;

    const response = await ollamaAIClient.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.3, maxTokens: 4096 }
    );

    // Strip markdown fences if present
    let code = response.content || '';
    code = code.replace(/^```(?:python|bash|sh)?\n?/m, '').replace(/\n?```\s*$/m, '');

    const ext = language === 'python' ? 'py' : 'sh';
    const filename = `poc-${vulnerabilityId?.substring(0, 8) || 'custom'}.${ext}`;

    return {
      type: 'poc_code',
      language,
      sourceCode: code,
      filename,
      dependencies: language === 'python' ? ['requests'] : [],
      usage: language === 'python'
        ? `python3 ${filename} --target <host> --port <port>`
        : `bash ${filename} <host> <port>`,
      reliability: 'low',
      metadata: {
        targetPlatform: language === 'bash' ? ['linux'] : ['linux', 'windows'],
        generatedBy: 'poc-development-agent',
      },
    };
  }

  private inferLanguage(researchArtifact?: ResearchArtifact, researchPackage?: any): string {
    const combined = JSON.stringify({
      artifact: researchArtifact?.metadata,
      methodology: researchPackage?.methodology,
    }).toLowerCase();

    // Windows targets → Python (cross-platform)
    if (/windows|win32|powershell/.test(combined)) return 'python';
    // Network-level / simple checks → Bash
    if (/curl|netcat|nmap|http.*get|banner/.test(combined)) return 'bash';
    // Default to Ruby (MSF module)
    return 'ruby';
  }
}

export const pocDevelopmentAgent = new PocDevelopmentAgent();
