/**
 * Web Hacker Agent
 *
 * Consumes vulnerability findings from target notes, selects appropriate tools
 * from the registry, executes nuclei scans with existing templates, and generates
 * custom nuclei templates for discovered vulnerabilities.
 *
 * Capabilities:
 * - vulnerability_analysis: Analyze vulnerabilities from target notes
 * - tool_selection: Select appropriate tools for exploitation
 * - nuclei_scanning: Execute nuclei template scans
 * - template_generation: Generate custom nuclei templates using AI
 */

import { db } from '../../db';
import {
  agents,
  targets,
  vulnerabilities,
  toolRegistry,
  operations,
  axScanResults,
  nucleiTemplates,
} from '../../../shared/schema';
import { NucleiExecutor } from '../nuclei-executor';
import { DockerExecutor } from '../docker-executor';
import { eq, and, inArray, like, or } from 'drizzle-orm';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface WebHackerConfig {
  nucleiTemplatesPath: string;
  customTemplatesPath: string;
  maxConcurrentScans: number;
  aiProvider: 'openai' | 'anthropic';
  aiModel: string;
  templateGenerationPrompt: string;
  scanTimeout: number;
  enableCustomTemplateGeneration: boolean;
}

export interface VulnerabilityTarget {
  id: string;
  name: string;
  value: string;
  severity: string;
  description: string;
  operationId: string;
  tags: string[];
}

export interface ExploitationResult {
  targetId: string;
  vulnerabilityName: string;
  status: 'validated' | 'not_vulnerable' | 'error';
  evidence: string;
  templatesUsed: string[];
  customTemplateGenerated?: string;
  scanDuration?: number;
}

export interface GeneratedTemplate {
  id: string;
  name: string;
  severity: string;
  path: string;
  content: string;
  targetVulnerability: string;
  operationId: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: WebHackerConfig = {
  nucleiTemplatesPath: '/home/rtpi-tools/nuclei-templates',
  customTemplatesPath: '/home/rtpi-tools/nuclei-templates/custom',
  maxConcurrentScans: 5,
  aiProvider: 'anthropic',
  aiModel: 'claude-3-5-sonnet-20241022',
  scanTimeout: 300000, // 5 minutes per scan
  enableCustomTemplateGeneration: true,
  templateGenerationPrompt: `You are a security researcher generating Nuclei templates.
Given the following vulnerability information, create a valid Nuclei template in YAML format.

Vulnerability: {{vulnerability_name}}
Severity: {{severity}}
Affected Asset: {{affected_asset}}
Description: {{description}}

Requirements:
1. Use Nuclei template v2 syntax
2. Include appropriate matchers (status code, word, regex)
3. Add extractors if applicable
4. Include metadata (author, severity, tags)
5. Make the template specific but not overly restrictive
6. Use proper indentation (2 spaces)
7. Include classification with cvss-metrics if applicable

Output ONLY the YAML template, no explanations or markdown code blocks.`,
};

// ============================================================================
// Vulnerability Type to Template Mapping
// ============================================================================

const VULN_TEMPLATE_MAPPING: Record<string, string[]> = {
  'sql injection': ['vulnerabilities/sqli/', 'cves/'],
  'sqli': ['vulnerabilities/sqli/', 'cves/'],
  'xss': ['vulnerabilities/xss/', 'cves/'],
  'cross-site scripting': ['vulnerabilities/xss/', 'cves/'],
  'ssrf': ['vulnerabilities/ssrf/', 'cves/'],
  'server-side request forgery': ['vulnerabilities/ssrf/', 'cves/'],
  'rce': ['vulnerabilities/rce/', 'cves/'],
  'remote code execution': ['vulnerabilities/rce/', 'cves/'],
  'command injection': ['vulnerabilities/rce/', 'cves/'],
  'lfi': ['vulnerabilities/lfi/', 'cves/'],
  'local file inclusion': ['vulnerabilities/lfi/', 'cves/'],
  'rfi': ['vulnerabilities/rfi/', 'cves/'],
  'remote file inclusion': ['vulnerabilities/rfi/', 'cves/'],
  'xxe': ['vulnerabilities/xxe/', 'cves/'],
  'xml external entity': ['vulnerabilities/xxe/', 'cves/'],
  'authentication': ['vulnerabilities/auth-bypass/', 'default-logins/'],
  'auth bypass': ['vulnerabilities/auth-bypass/', 'default-logins/'],
  'information disclosure': ['exposures/', 'misconfiguration/'],
  'exposure': ['exposures/', 'misconfiguration/'],
  'misconfiguration': ['misconfiguration/', 'exposures/'],
  'default credentials': ['default-logins/', 'misconfiguration/'],
  'open redirect': ['vulnerabilities/redirect/', 'cves/'],
  'path traversal': ['vulnerabilities/lfi/', 'cves/'],
  'idor': ['vulnerabilities/idor/', 'cves/'],
  'csrf': ['vulnerabilities/csrf/', 'cves/'],
  'deserialization': ['vulnerabilities/deserialization/', 'cves/'],
  'default': ['vulnerabilities/', 'cves/'],
};

// ============================================================================
// Web Hacker Agent
// ============================================================================

export class WebHackerAgent extends EventEmitter {
  private config: WebHackerConfig;
  private nucleiExecutor: NucleiExecutor;
  private dockerExecutor: DockerExecutor;
  private agentId: string | null = null;
  private activeScans: Set<string> = new Set();

  constructor(config: Partial<WebHackerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.nucleiExecutor = new NucleiExecutor();
    this.dockerExecutor = new DockerExecutor();
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    // Check if agent exists, create if not
    const [existingAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.name, 'Web Hacker Agent'));

    if (existingAgent) {
      this.agentId = existingAgent.id;
      console.log(`Web Hacker Agent found: ${this.agentId}`);
    } else {
      const [newAgent] = await db
        .insert(agents)
        .values({
          name: 'Web Hacker Agent',
          type: 'custom',
          status: 'idle',
          config: {
            handlerPath: './agents/web-hacker-agent',
            ...this.config,
          },
          capabilities: [
            'vulnerability_analysis',
            'tool_selection',
            'nuclei_scanning',
            'template_generation',
          ],
        })
        .returning();
      this.agentId = newAgent.id;
      console.log(`Web Hacker Agent created: ${this.agentId}`);
    }

    // Register with dynamic workflow orchestrator
    try {
      const { dynamicWorkflowOrchestrator } = await import('../dynamic-workflow-orchestrator');
      await dynamicWorkflowOrchestrator.registerAgent(
        this.agentId,
        [
          {
            capability: 'vulnerability_analysis',
            inputTypes: ['target_notes', 'discovered_vulnerabilities'],
            outputTypes: ['vulnerability_targets'],
            priority: 10,
          },
          {
            capability: 'tool_selection',
            inputTypes: ['vulnerability_targets', 'tool_list'],
            outputTypes: ['selected_tools', 'template_paths'],
            priority: 10,
          },
          {
            capability: 'nuclei_scanning',
            inputTypes: ['vulnerability_targets', 'template_paths'],
            outputTypes: ['scan_results', 'validated_vulnerabilities'],
            priority: 10,
          },
          {
            capability: 'template_generation',
            inputTypes: ['vulnerability_targets'],
            outputTypes: ['nuclei_templates'],
            priority: 10,
          },
        ],
        [
          {
            dependsOnCapability: 'finding_documentation',
            type: 'required',
          },
          {
            dependsOnCapability: 'tool_discovery',
            type: 'optional',
          },
        ]
      );
      console.log('Web Hacker Agent registered with orchestrator');
    } catch (error) {
      console.warn('Could not register with orchestrator:', error);
    }

    // Ensure custom templates directory exists
    await this.ensureCustomTemplatesDir();
  }

  /**
   * Ensure custom templates directory exists
   */
  private async ensureCustomTemplatesDir(): Promise<void> {
    try {
      await this.dockerExecutor.exec(
        `mkdir -p ${this.config.customTemplatesPath}`,
        { container: 'rtpi-tools', timeout: 10000 }
      );
    } catch (error) {
      console.warn('Could not create custom templates directory:', error);
    }
  }

  /**
   * Process an operation - main entry point
   */
  async processOperation(operationId: string, userId: string): Promise<ExploitationResult[]> {
    console.log(`Web Hacker Agent: Processing operation ${operationId}`);
    this.emit('operation_started', operationId);

    // Update agent status
    await this.updateAgentStatus('running');

    try {
      // Step 1: Get vulnerability targets from target notes
      const vulnerabilityTargets = await this.getVulnerabilityTargets(operationId);

      if (vulnerabilityTargets.length === 0) {
        console.log('Web Hacker Agent: No vulnerability targets found');
        await this.updateAgentStatus('idle');
        return [];
      }

      console.log(`Web Hacker Agent: Found ${vulnerabilityTargets.length} vulnerability targets`);
      this.emit('targets_identified', { operationId, count: vulnerabilityTargets.length });

      const results: ExploitationResult[] = [];

      // Process each vulnerability target
      for (const target of vulnerabilityTargets) {
        try {
          const result = await this.processVulnerabilityTarget(target, operationId, userId);
          results.push(result);
          this.emit('target_processed', { operationId, targetId: target.id, result });
        } catch (error) {
          console.error(`Failed to process target ${target.id}:`, error);
          results.push({
            targetId: target.id,
            vulnerabilityName: target.name,
            status: 'error',
            evidence: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            templatesUsed: [],
          });
        }
      }

      // Update operation summary
      await this.updateOperationSummary(operationId, results);

      await this.updateAgentStatus('idle');
      this.emit('operation_completed', { operationId, results });

      return results;
    } catch (error) {
      console.error(`Web Hacker Agent failed for operation ${operationId}:`, error);
      await this.updateAgentStatus('error');
      this.emit('operation_failed', { operationId, error });
      throw error;
    }
  }

  /**
   * Update agent status in database
   */
  private async updateAgentStatus(status: 'idle' | 'running' | 'error'): Promise<void> {
    if (this.agentId) {
      await db
        .update(agents)
        .set({ status, lastActivity: new Date() })
        .where(eq(agents.id, this.agentId));
    }
  }

  /**
   * Step 1: Get vulnerability targets from database
   */
  async getVulnerabilityTargets(operationId: string): Promise<VulnerabilityTarget[]> {
    // Get targets that have 'vulnerability' or 'pending-exploitation' tags
    const allTargets = await db
      .select()
      .from(targets)
      .where(eq(targets.operationId, operationId));

    // Filter for vulnerability targets
    const vulnTargets = allTargets.filter(t => {
      const tags = (t.tags as string[]) || [];
      const name = t.name || '';
      return (
        tags.includes('vulnerability') ||
        tags.includes('pending-exploitation') ||
        name.toLowerCase().includes('vulnerability')
      );
    });

    return vulnTargets.map(t => ({
      id: t.id,
      name: t.name?.replace('Vulnerability: ', '') || 'Unknown',
      value: t.value || '',
      severity: this.extractSeverity(t),
      description: t.description || '',
      operationId: t.operationId || '',
      tags: (t.tags as string[]) || [],
    }));
  }

  /**
   * Extract severity from target
   */
  private extractSeverity(target: any): string {
    const tags = (target.tags as string[]) || [];
    const severities = ['critical', 'high', 'medium', 'low', 'info'];

    for (const severity of severities) {
      if (tags.includes(severity)) {
        return severity;
      }
    }

    // Try to extract from description
    const desc = (target.description || '').toLowerCase();
    for (const severity of severities) {
      if (desc.includes(`severity: ${severity}`)) {
        return severity;
      }
    }

    return 'unknown';
  }

  /**
   * Process a single vulnerability target
   */
  async processVulnerabilityTarget(
    target: VulnerabilityTarget,
    operationId: string,
    userId: string
  ): Promise<ExploitationResult> {
    console.log(`Web Hacker Agent: Processing vulnerability "${target.name}" on ${target.value}`);
    const startTime = Date.now();

    // Step 2: Select appropriate templates
    const templates = await this.selectTemplates(target);
    console.log(`Web Hacker Agent: Selected ${templates.length} template paths`);

    // Step 3: Execute nuclei scan with selected templates
    let scanResult = await this.executeScan(target, templates, operationId, userId);
    scanResult.scanDuration = Math.round((Date.now() - startTime) / 1000);

    // Step 4: If no results and custom template generation is enabled, generate custom template
    if (
      scanResult.status === 'not_vulnerable' &&
      target.severity !== 'low' &&
      target.severity !== 'info' &&
      this.config.enableCustomTemplateGeneration
    ) {
      console.log('Web Hacker Agent: Generating custom template...');

      const customTemplate = await this.generateCustomTemplate(target, operationId);

      if (customTemplate) {
        // Write template to disk and database
        await this.saveTemplate(customTemplate);

        // Re-run scan with custom template
        const retryResult = await this.executeScan(
          target,
          [customTemplate.path],
          operationId,
          userId
        );

        if (retryResult.status === 'validated') {
          scanResult = retryResult;
        }
        scanResult.customTemplateGenerated = customTemplate.path;
        scanResult.templatesUsed.push(customTemplate.path);
      }
    }

    // Update target status
    await this.updateTargetStatus(target.id, scanResult.status, scanResult.evidence);

    return scanResult;
  }

  /**
   * Step 2: Select appropriate nuclei templates
   */
  async selectTemplates(target: VulnerabilityTarget): Promise<string[]> {
    const templates: string[] = [];
    const vulnName = target.name.toLowerCase();

    // Find matching template paths based on vulnerability type
    let foundMatch = false;
    for (const [keyword, paths] of Object.entries(VULN_TEMPLATE_MAPPING)) {
      if (vulnName.includes(keyword)) {
        templates.push(...paths);
        foundMatch = true;
        break;
      }
    }

    // If no specific match, use default templates
    if (!foundMatch) {
      templates.push(...VULN_TEMPLATE_MAPPING.default);
    }

    // Check for CVE in name
    const cveMatch = target.name.match(/CVE-\d{4}-\d+/i);
    if (cveMatch) {
      const cveId = cveMatch[0].toUpperCase();
      const year = cveId.split('-')[1];
      templates.unshift(`cves/${year}/${cveId}.yaml`);
    }

    // Check for existing custom templates in database
    const customTemplates = await db
      .select()
      .from(nucleiTemplates)
      .where(eq(nucleiTemplates.operationId, target.operationId));

    for (const ct of customTemplates) {
      if (ct.filePath) {
        templates.push(ct.filePath);
      }
    }

    // Also check for custom templates on disk
    try {
      const customResult = await this.dockerExecutor.exec(
        `ls ${this.config.customTemplatesPath}/*.yaml 2>/dev/null || true`,
        { container: 'rtpi-tools', timeout: 10000 }
      );

      if (customResult.stdout?.trim()) {
        const diskTemplates = customResult.stdout.trim().split('\n').filter(Boolean);
        templates.push(...diskTemplates);
      }
    } catch (error) {
      // No custom templates on disk, continue
    }

    return [...new Set(templates)]; // Deduplicate
  }

  /**
   * Step 3: Execute nuclei scan
   */
  async executeScan(
    target: VulnerabilityTarget,
    templatePaths: string[],
    operationId: string,
    userId: string
  ): Promise<ExploitationResult> {
    // Build target URL if needed
    const scanTarget = this.normalizeTarget(target.value);

    const nucleiOptions = {
      severity: ['critical', 'high', 'medium', 'low', 'info'],
      rateLimit: 50,
      templates: templatePaths.filter(t => !t.includes('*')), // Filter out wildcard paths
      templateDirs: templatePaths.filter(t => t.endsWith('/')), // Use dirs for paths ending in /
      concurrency: 25,
      timeout: 30,
      retries: 2,
    };

    try {
      // Check concurrent scan limit
      if (this.activeScans.size >= this.config.maxConcurrentScans) {
        await this.waitForScanSlot();
      }

      this.activeScans.add(target.id);

      const { scanId } = await this.nucleiExecutor.startScan(
        [scanTarget],
        nucleiOptions,
        operationId,
        userId
      );

      // Wait for completion
      const result = await this.waitForScanCompletion(scanId);

      this.activeScans.delete(target.id);

      // Check if vulnerability was found
      const vulnsFound = result.vulnerabilitiesFound || 0;
      const findings = (result.findings as any[]) || [];

      let evidence = '';
      if (vulnsFound > 0 && findings.length > 0) {
        evidence = findings
          .slice(0, 5)
          .map((f: any) => `- ${f.templateId || 'Unknown'}: ${f.name || f.matched || 'Match found'}`)
          .join('\n');
      }

      return {
        targetId: target.id,
        vulnerabilityName: target.name,
        status: vulnsFound > 0 ? 'validated' : 'not_vulnerable',
        evidence:
          vulnsFound > 0
            ? `Found ${vulnsFound} matching vulnerabilities:\n${evidence}`
            : 'No vulnerabilities confirmed with available templates',
        templatesUsed: templatePaths,
      };
    } catch (error) {
      this.activeScans.delete(target.id);
      return {
        targetId: target.id,
        vulnerabilityName: target.name,
        status: 'error',
        evidence: `Scan error: ${error instanceof Error ? error.message : 'Unknown'}`,
        templatesUsed: templatePaths,
      };
    }
  }

  /**
   * Normalize target to URL format
   */
  private normalizeTarget(target: string): string {
    if (!target) return '';

    // Already a URL
    if (target.startsWith('http://') || target.startsWith('https://')) {
      return target;
    }

    // IP address or domain - add https
    if (/^[\d.]+$/.test(target) || /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(target)) {
      return `https://${target}`;
    }

    return target;
  }

  /**
   * Wait for an available scan slot
   */
  private async waitForScanSlot(timeoutMs: number = 60000): Promise<void> {
    const startTime = Date.now();
    const pollIntervalMs = 1000;

    while (this.activeScans.size >= this.config.maxConcurrentScans) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('Timeout waiting for scan slot');
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  /**
   * Wait for scan completion
   */
  private async waitForScanCompletion(
    scanId: string,
    timeoutMs: number = 300000
  ): Promise<any> {
    const startTime = Date.now();
    const pollIntervalMs = 5000;

    while (Date.now() - startTime < timeoutMs) {
      const [scan] = await db
        .select()
        .from(axScanResults)
        .where(eq(axScanResults.id, scanId));

      if (!scan) {
        throw new Error(`Scan ${scanId} not found`);
      }

      if (scan.status === 'completed' || scan.status === 'failed') {
        return scan;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Scan timed out after ${timeoutMs}ms`);
  }

  /**
   * Step 4: Generate custom nuclei template using AI
   */
  async generateCustomTemplate(
    target: VulnerabilityTarget,
    operationId: string
  ): Promise<GeneratedTemplate | null> {
    try {
      // Build prompt
      const prompt = this.config.templateGenerationPrompt
        .replace('{{vulnerability_name}}', target.name)
        .replace('{{severity}}', target.severity)
        .replace('{{affected_asset}}', target.value)
        .replace('{{description}}', target.description.substring(0, 500));

      // Call AI
      const templateContent = await this.callAI(prompt);

      if (!templateContent || !templateContent.includes('id:')) {
        console.warn('AI did not generate valid template');
        return null;
      }

      // Clean up template content (remove markdown code blocks if present)
      let cleanContent = templateContent
        .replace(/^```yaml\n?/i, '')
        .replace(/^```\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim();

      // Parse template ID from content
      const idMatch = cleanContent.match(/id:\s*([a-z0-9-]+)/i);
      const templateId = idMatch
        ? idMatch[1].toLowerCase()
        : `custom-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const templatePath = `${this.config.customTemplatesPath}/${templateId}.yaml`;

      return {
        id: templateId,
        name: target.name,
        severity: target.severity,
        path: templatePath,
        content: cleanContent,
        targetVulnerability: target.name,
        operationId,
      };
    } catch (error) {
      console.error('Failed to generate custom template:', error);
      return null;
    }
  }

  /**
   * Call AI provider for template generation
   */
  private async callAI(prompt: string): Promise<string> {
    try {
      const { AgentWorkflowOrchestrator } = await import('../agent-workflow-orchestrator');
      const orchestrator = new AgentWorkflowOrchestrator();

      const result = await orchestrator.callAgentAI(this.config.aiProvider, prompt, {
        model: this.config.aiModel,
        maxTokens: 2000,
        temperature: 0.3, // Lower temperature for more consistent YAML output
      });

      return result?.content || '';
    } catch (error) {
      console.error('AI call failed:', error);
      return '';
    }
  }

  /**
   * Save template to disk and database
   */
  async saveTemplate(template: GeneratedTemplate): Promise<void> {
    // Write via docker exec
    const escapedContent = template.content.replace(/'/g, "'\\''");

    try {
      await this.dockerExecutor.exec(
        `cat > "${template.path}" << 'TEMPLATE_EOF'
${template.content}
TEMPLATE_EOF`,
        { container: 'rtpi-tools', timeout: 10000 }
      );

      console.log(`Web Hacker Agent: Wrote custom template to ${template.path}`);
    } catch (error) {
      console.error('Failed to write template to disk:', error);
    }

    // Save to database
    try {
      await db.insert(nucleiTemplates).values({
        operationId: template.operationId,
        templateId: template.id,
        name: template.name,
        severity: template.severity,
        filePath: template.path,
        content: template.content,
        isCustom: true,
        generatedFor: template.targetVulnerability,
        metadata: {
          generatedAt: new Date().toISOString(),
          aiProvider: this.config.aiProvider,
          aiModel: this.config.aiModel,
        },
      });
    } catch (error) {
      console.error('Failed to save template to database:', error);
    }

    this.emit('template_generated', template);
  }

  /**
   * Update target status based on exploitation result
   */
  async updateTargetStatus(
    targetId: string,
    status: ExploitationResult['status'],
    evidence: string
  ): Promise<void> {
    const currentTarget = await db
      .select()
      .from(targets)
      .where(eq(targets.id, targetId));

    if (currentTarget.length === 0) return;

    const existingDesc = currentTarget[0].description || '';
    const existingTags = (currentTarget[0].tags as string[]) || [];

    // Update tags based on status
    const newTags = existingTags.filter(
      (t) => !['pending-exploitation', 'validated', 'not-vulnerable', 'error'].includes(t)
    );

    if (status === 'validated') {
      newTags.push('validated');
    } else if (status === 'not_vulnerable') {
      newTags.push('not-vulnerable');
    } else {
      newTags.push('error');
    }

    // Append validation results to description
    const validationNote = `

---
### Web Hacker Agent Validation
**Status:** ${status}
**Timestamp:** ${new Date().toISOString()}

**Evidence:**
${evidence}
`;

    await db
      .update(targets)
      .set({
        description: existingDesc + validationNote,
        tags: newTags,
        updatedAt: new Date(),
      })
      .where(eq(targets.id, targetId));
  }

  /**
   * Update operation summary with exploitation results
   */
  async updateOperationSummary(
    operationId: string,
    results: ExploitationResult[]
  ): Promise<void> {
    const validated = results.filter((r) => r.status === 'validated').length;
    const notVulnerable = results.filter((r) => r.status === 'not_vulnerable').length;
    const errors = results.filter((r) => r.status === 'error').length;
    const customTemplates = results.filter((r) => r.customTemplateGenerated).length;
    const totalDuration = results.reduce((sum, r) => sum + (r.scanDuration || 0), 0);

    const summaryContent = `
## Web Hacker Agent Results

**Scan Date:** ${new Date().toISOString()}
**Total Duration:** ${totalDuration} seconds

### Summary
- **Total Targets Processed:** ${results.length}
- **Validated Vulnerabilities:** ${validated}
- **Not Vulnerable:** ${notVulnerable}
- **Errors:** ${errors}
- **Custom Templates Generated:** ${customTemplates}

### Detailed Results
${results
  .map(
    (r) => `
#### ${r.vulnerabilityName}
- **Status:** ${r.status}
- **Evidence:** ${r.evidence.substring(0, 500)}
- **Templates Used:** ${r.templatesUsed.slice(0, 5).join(', ')}${r.templatesUsed.length > 5 ? ` (+${r.templatesUsed.length - 5} more)` : ''}
${r.customTemplateGenerated ? `- **Custom Template:** ${r.customTemplateGenerated}` : ''}
`
  )
  .join('\n')}

---
*Generated by Web Hacker Agent*
`;

    // Find Surface Assessment Findings target and append
    const [findingsTarget] = await db
      .select()
      .from(targets)
      .where(
        and(
          eq(targets.operationId, operationId),
          eq(targets.name, 'Surface Assessment Findings')
        )
      );

    if (findingsTarget) {
      const existingDesc = findingsTarget.description || '';
      const updatedDescription = `${existingDesc}\n\n${summaryContent}`;
      await db
        .update(targets)
        .set({ description: updatedDescription, updatedAt: new Date() })
        .where(eq(targets.id, findingsTarget.id));
    } else {
      // Create a new summary target if Surface Assessment Findings doesn't exist
      await db.insert(targets).values({
        operationId,
        name: 'Web Hacker Agent Results',
        type: 'url',
        value: 'web-hacker-summary',
        description: summaryContent,
        priority: 1,
        tags: ['web-hacker', 'auto-generated', 'summary'],
      });
    }
  }

  /**
   * Execute handler for workflow orchestrator
   */
  static async execute(context: Record<string, any>): Promise<ExploitationResult[]> {
    const agent = new WebHackerAgent(context.config);
    await agent.initialize();
    return agent.processOperation(context.operationId, context.userId || 'system');
  }

  /**
   * Get agent status
   */
  getStatus(): {
    agentId: string | null;
    activeScans: number;
    maxConcurrentScans: number;
  } {
    return {
      agentId: this.agentId,
      activeScans: this.activeScans.size,
      maxConcurrentScans: this.config.maxConcurrentScans,
    };
  }
}

// Singleton instance
export const webHackerAgent = new WebHackerAgent();

// Export execute function for dynamic import
export const execute = WebHackerAgent.execute;
