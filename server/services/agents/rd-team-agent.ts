/**
 * R&D Team Agent
 *
 * Conducts CVE research, generates custom Nuclei templates using AI,
 * deploys them to the tools container, and validates them against targets.
 *
 * Capabilities:
 * - cve_research: Research CVE details and exploit information via Tavily
 * - nuclei_template_generation: AI-powered YAML Nuclei template generation
 * - template_validation: Test generated templates against live targets
 * - exploit_research: PoC discovery and analysis
 */

import { BaseTaskAgent, TaskDefinition, TaskResult } from './base-task-agent';
import { db } from '../../db';
import { nucleiTemplates, vulnerabilities } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { agentMessageBus } from '../agent-message-bus';

// ============================================================================
// Types
// ============================================================================

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string;
}

interface TavilyResponse {
  query: string;
  results: TavilySearchResult[];
  answer?: string;
}

interface ResearchPackage {
  cveId: string | null;
  description: string;
  service?: string;
  version?: string;
  severity?: string;
  cvssScore?: number;
  cvssVector?: string;
  cweId?: string;
  affectedProducts: string[];
  exploitMethodology: string[];
  pocUrls: string[];
  references: string[];
  mitigations: string[];
  rawResults: TavilySearchResult[];
}

interface TemplateGenerationResult {
  templateId: string;
  dbId: string;
  yamlContent: string;
  name: string;
  severity: string;
}

interface ValidationResult {
  templateId: string;
  targetUrl: string;
  success: boolean;
  findingsCount: number;
  findings: any[];
  error?: string;
}

// ============================================================================
// R&D Team Agent
// ============================================================================

export class RDTeamAgent extends BaseTaskAgent {
  constructor() {
    super(
      'R&D Team',
      'rd_team',
      ['cve_research', 'nuclei_template_generation', 'template_validation', 'exploit_research']
    );
  }

  // ==========================================================================
  // Task Execution
  // ==========================================================================

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    await this.updateStatus('running');

    try {
      let result: TaskResult;

      switch (task.taskType) {
        case 'cve_research':
          result = await this.handleCVEResearch(task);
          break;
        case 'nuclei_template_generation':
          result = await this.handleTemplateGeneration(task);
          break;
        case 'template_validation':
          result = await this.handleTemplateValidation(task);
          break;
        case 'exploit_research':
          result = await this.handleExploitResearch(task);
          break;
        case 'full_pipeline':
          result = await this.handleFullPipeline(task);
          break;
        default:
          result = { success: false, error: `Unknown task type: ${task.taskType}` };
      }

      // Store result in memory
      await this.storeTaskMemory({ task, result, memoryType: 'event' });

      await this.updateStatus('idle');
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[R&D Team] Task failed: ${errorMsg}`);
      await this.updateStatus('error');

      const result: TaskResult = { success: false, error: errorMsg };
      await this.storeTaskMemory({ task, result, memoryType: 'event' });
      return result;
    }
  }

  // ==========================================================================
  // Task Handlers
  // ==========================================================================

  /**
   * Research a CVE or vulnerability using Tavily search API.
   */
  private async handleCVEResearch(task: TaskDefinition): Promise<TaskResult> {
    const { cveId, description, service, version } = task.parameters;

    if (!cveId && !description && !service) {
      return { success: false, error: 'Missing required parameters: at least one of cveId, description, or service is required' };
    }

    console.log(`[R&D Team] Researching vulnerability: ${cveId || description || `${service} ${version || ''}`}`);
    await this.reportProgress(task.id || 'research', 10, 'Starting CVE research');

    try {
      const research = await this.researchVulnerability(cveId, description, service, version);
      await this.reportProgress(task.id || 'research', 100, 'Research complete');

      if (research.rawResults.length === 0) {
        await this.reportBlocker(task, `No research results found for ${cveId || description || service}`);
        return {
          success: false,
          error: 'No research results found',
          data: { research },
        };
      }

      return {
        success: true,
        data: {
          research,
          resultCount: research.rawResults.length,
          pocCount: research.pocUrls.length,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Research failed';
      await this.reportBlocker(task, `CVE research failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Generate a Nuclei template from research data or vulnerability parameters.
   */
  private async handleTemplateGeneration(task: TaskDefinition): Promise<TaskResult> {
    const { research, cveId, description, severity, service, version, vulnerabilityId } = task.parameters;

    let researchPackage: ResearchPackage = research;

    // If no research provided, do research first
    if (!researchPackage) {
      if (!cveId && !description) {
        return { success: false, error: 'Missing required parameters: either research package or cveId/description' };
      }
      console.log(`[R&D Team] No research provided, researching first...`);
      await this.reportProgress(task.id || 'template-gen', 10, 'Researching vulnerability before template generation');
      researchPackage = await this.researchVulnerability(cveId, description, service, version);
      await this.reportProgress(task.id || 'template-gen', 30, 'Research complete, generating template');
    }

    console.log(`[R&D Team] Generating Nuclei template for: ${researchPackage.cveId || researchPackage.description}`);
    await this.reportProgress(task.id || 'template-gen', 40, 'Generating Nuclei template via AI');

    try {
      const templateResult = await this.generateNucleiTemplate(researchPackage, vulnerabilityId);
      await this.reportProgress(task.id || 'template-gen', 70, 'Template generated, deploying to container');

      // Deploy template to container
      await this.deployTemplate(templateResult.templateId, templateResult.yamlContent);
      await this.reportProgress(task.id || 'template-gen', 100, 'Template deployed');

      return {
        success: true,
        data: {
          templateId: templateResult.templateId,
          dbId: templateResult.dbId,
          name: templateResult.name,
          severity: templateResult.severity,
          yamlContent: templateResult.yamlContent,
          deployed: true,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Template generation failed';
      await this.reportBlocker(task, `Nuclei template generation failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Validate a template by running it against a target.
   */
  private async handleTemplateValidation(task: TaskDefinition): Promise<TaskResult> {
    const { templateId, targetUrl, operationId } = task.parameters;

    if (!templateId || !targetUrl) {
      return { success: false, error: 'Missing required parameters: templateId, targetUrl' };
    }

    console.log(`[R&D Team] Validating template ${templateId} against ${targetUrl}`);
    await this.reportProgress(task.id || 'validate', 10, 'Starting template validation');

    try {
      const validationResult = await this.validateTemplate(templateId, targetUrl, operationId);
      await this.reportProgress(task.id || 'validate', 100, 'Validation complete');

      return {
        success: true,
        data: {
          templateId,
          targetUrl,
          validated: validationResult.success,
          findingsCount: validationResult.findingsCount,
          findings: validationResult.findings,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Validation failed';
      return { success: false, error: errorMsg, data: { templateId, targetUrl } };
    }
  }

  /**
   * Research exploits and PoCs for a specific vulnerability.
   */
  private async handleExploitResearch(task: TaskDefinition): Promise<TaskResult> {
    const { cveId, description, service, version } = task.parameters;

    if (!cveId && !service) {
      return { success: false, error: 'Missing required parameters: cveId or service' };
    }

    console.log(`[R&D Team] Researching exploits for: ${cveId || `${service} ${version || ''}`}`);
    await this.reportProgress(task.id || 'exploit', 10, 'Starting exploit research');

    try {
      const exploitResults = await this.searchExploits(cveId, service, version);
      await this.reportProgress(task.id || 'exploit', 100, 'Exploit research complete');

      return {
        success: true,
        data: {
          cveId,
          service,
          version,
          exploits: exploitResults,
          exploitCount: exploitResults.length,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Exploit research failed';
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Full pipeline: Research -> Generate Template -> Deploy -> Validate
   */
  private async handleFullPipeline(task: TaskDefinition): Promise<TaskResult> {
    const { cveId, description, service, version, targetUrl, operationId, vulnerabilityId } = task.parameters;

    if (!cveId && !description && !service) {
      return { success: false, error: 'Missing required parameters: at least one of cveId, description, or service' };
    }

    console.log(`[R&D Team] Running full pipeline for: ${cveId || description || `${service} ${version || ''}`}`);

    // Step 1: Research
    await this.reportProgress(task.id || 'pipeline', 10, 'Step 1/4: Researching vulnerability');
    const research = await this.researchVulnerability(cveId, description, service, version);

    if (research.rawResults.length === 0) {
      await this.reportBlocker(task, `No research results found for ${cveId || description || service}. Cannot proceed with template generation.`);
      return {
        success: false,
        error: 'No research results found — pipeline halted',
        data: { stage: 'research', research },
      };
    }

    // Step 2: Generate template
    await this.reportProgress(task.id || 'pipeline', 30, 'Step 2/4: Generating Nuclei template');
    let templateResult: TemplateGenerationResult;
    try {
      templateResult = await this.generateNucleiTemplate(research, vulnerabilityId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Template generation failed';
      await this.reportBlocker(task, `Template generation failed: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
        data: { stage: 'template_generation', research },
      };
    }

    // Step 3: Deploy template
    await this.reportProgress(task.id || 'pipeline', 60, 'Step 3/4: Deploying template to container');
    try {
      await this.deployTemplate(templateResult.templateId, templateResult.yamlContent);
    } catch (error) {
      console.warn(`[R&D Team] Template deployment failed (non-fatal): ${error}`);
      // Non-fatal — template is still in the database
    }

    // Step 4: Validate (only if target URL provided)
    let validationResult: ValidationResult | null = null;
    if (targetUrl) {
      await this.reportProgress(task.id || 'pipeline', 80, 'Step 4/4: Validating template against target');
      try {
        validationResult = await this.validateTemplate(templateResult.templateId, targetUrl, operationId);
      } catch (error) {
        console.warn(`[R&D Team] Template validation failed (non-fatal): ${error}`);
      }
    }

    await this.reportProgress(task.id || 'pipeline', 100, 'Pipeline complete');

    return {
      success: true,
      data: {
        research: {
          cveId: research.cveId,
          resultCount: research.rawResults.length,
          pocCount: research.pocUrls.length,
          severity: research.severity,
        },
        template: {
          templateId: templateResult.templateId,
          dbId: templateResult.dbId,
          name: templateResult.name,
          severity: templateResult.severity,
        },
        validation: validationResult
          ? {
              validated: validationResult.success,
              findingsCount: validationResult.findingsCount,
            }
          : null,
      },
    };
  }

  // ==========================================================================
  // CVE Research (Tavily)
  // ==========================================================================

  /**
   * Research a vulnerability using the Tavily search API.
   * Falls back gracefully if TAVILY_API_KEY is not configured.
   */
  async researchVulnerability(
    cveId?: string,
    description?: string,
    service?: string,
    version?: string
  ): Promise<ResearchPackage> {
    const research: ResearchPackage = {
      cveId: cveId || null,
      description: description || '',
      service,
      version,
      affectedProducts: [],
      exploitMethodology: [],
      pocUrls: [],
      references: [],
      mitigations: [],
      rawResults: [],
    };

    const tavilyApiKey = process.env.TAVILY_API_KEY;
    if (!tavilyApiKey) {
      console.warn('[R&D Team] TAVILY_API_KEY not configured — skipping web research');
      return research;
    }

    // Build search query
    const queryParts: string[] = [];
    if (cveId) queryParts.push(cveId);
    if (service) queryParts.push(service);
    if (version) queryParts.push(version);
    if (!cveId && description) queryParts.push(description.slice(0, 200));
    queryParts.push('CVE vulnerability exploit');

    const query = queryParts.join(' ');

    try {
      // Primary search: CVE details and exploits
      const searchResponse = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query,
          search_depth: 'advanced',
          max_results: 10,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!searchResponse.ok) {
        throw new Error(`Tavily API returned ${searchResponse.status}: ${await searchResponse.text()}`);
      }

      const searchData = (await searchResponse.json()) as TavilyResponse;
      research.rawResults = searchData.results || [];

      // Parse results to extract structured data
      this.parseResearchResults(research);

      // Secondary search for PoCs (if CVE ID is available)
      if (cveId) {
        try {
          const pocResponse = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: tavilyApiKey,
              query: `${cveId} proof of concept exploit github`,
              search_depth: 'advanced',
              max_results: 5,
            }),
            signal: AbortSignal.timeout(30000),
          });

          if (pocResponse.ok) {
            const pocData = (await pocResponse.json()) as TavilyResponse;
            for (const result of pocData.results || []) {
              if (result.url.includes('github.com') || result.url.includes('exploit-db.com') || result.url.includes('packetstorm')) {
                research.pocUrls.push(result.url);
              }
              // Add to raw results for comprehensive data
              research.rawResults.push(result);
            }
          }
        } catch (pocError) {
          console.warn(`[R&D Team] PoC search failed (non-fatal): ${pocError}`);
        }
      }

      console.log(`[R&D Team] Research complete: ${research.rawResults.length} results, ${research.pocUrls.length} PoCs found`);
    } catch (error) {
      console.error('[R&D Team] Tavily search failed:', error);
      throw new Error(`CVE research failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return research;
  }

  /**
   * Parse raw Tavily results to extract structured vulnerability information.
   */
  private parseResearchResults(research: ResearchPackage): void {
    for (const result of research.rawResults) {
      const content = (result.content || '').toLowerCase();
      const url = result.url || '';

      // Extract references
      if (url) {
        research.references.push(url);
      }

      // Extract severity from content
      if (!research.severity) {
        if (content.includes('critical')) research.severity = 'critical';
        else if (content.includes('high severity') || content.includes('high risk')) research.severity = 'high';
        else if (content.includes('medium severity') || content.includes('medium risk')) research.severity = 'medium';
        else if (content.includes('low severity') || content.includes('low risk')) research.severity = 'low';
      }

      // Extract CVSS score
      if (!research.cvssScore) {
        const cvssMatch = (result.content || '').match(/CVSS[:\s]*(?:v?3\.?\d?\s*)?(?:Base\s*)?[Ss]core[:\s]*(\d+\.?\d*)/i);
        if (cvssMatch) {
          research.cvssScore = parseFloat(cvssMatch[1]);
        }
      }

      // Extract CVSS vector
      if (!research.cvssVector) {
        const vectorMatch = (result.content || '').match(/CVSS:3\.\d\/[A-Z:\/]+/);
        if (vectorMatch) {
          research.cvssVector = vectorMatch[0];
        }
      }

      // Extract CWE
      if (!research.cweId) {
        const cweMatch = (result.content || '').match(/CWE-(\d+)/i);
        if (cweMatch) {
          research.cweId = `CWE-${cweMatch[1]}`;
        }
      }

      // Extract PoC URLs
      if (url.includes('github.com') && (content.includes('poc') || content.includes('proof of concept') || content.includes('exploit'))) {
        if (!research.pocUrls.includes(url)) {
          research.pocUrls.push(url);
        }
      }
      if (url.includes('exploit-db.com') || url.includes('packetstormsecurity.com')) {
        if (!research.pocUrls.includes(url)) {
          research.pocUrls.push(url);
        }
      }

      // Extract affected products
      const productMatch = (result.content || '').match(/(?:affects?|impacts?|vulnerable)\s+([^.]+)/i);
      if (productMatch && productMatch[1].length < 200) {
        research.affectedProducts.push(productMatch[1].trim());
      }

      // Build description from first quality result
      if (!research.description && result.content && result.content.length > 50) {
        research.description = result.content.slice(0, 500);
      }
    }

    // Deduplicate
    research.pocUrls = [...new Set(research.pocUrls)];
    research.references = [...new Set(research.references)];
    research.affectedProducts = [...new Set(research.affectedProducts)].slice(0, 10);
  }

  // ==========================================================================
  // Exploit Research
  // ==========================================================================

  /**
   * Search specifically for exploit PoCs and technical details.
   */
  private async searchExploits(
    cveId?: string,
    service?: string,
    version?: string
  ): Promise<Array<{ title: string; url: string; description: string; source: string }>> {
    const tavilyApiKey = process.env.TAVILY_API_KEY;
    if (!tavilyApiKey) {
      console.warn('[R&D Team] TAVILY_API_KEY not configured — cannot search exploits');
      return [];
    }

    const queryParts: string[] = [];
    if (cveId) queryParts.push(cveId);
    if (service) queryParts.push(service);
    if (version) queryParts.push(version);
    queryParts.push('exploit proof of concept PoC');

    const exploits: Array<{ title: string; url: string; description: string; source: string }> = [];

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query: queryParts.join(' '),
          search_depth: 'advanced',
          max_results: 10,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Tavily API returned ${response.status}`);
      }

      const data = (await response.json()) as TavilyResponse;

      for (const result of data.results || []) {
        let source = 'web';
        if (result.url.includes('github.com')) source = 'github';
        else if (result.url.includes('exploit-db.com')) source = 'exploit-db';
        else if (result.url.includes('packetstorm')) source = 'packetstorm';
        else if (result.url.includes('nvd.nist.gov')) source = 'nvd';
        else if (result.url.includes('cve.mitre.org') || result.url.includes('cve.org')) source = 'cve';

        exploits.push({
          title: result.title,
          url: result.url,
          description: (result.content || '').slice(0, 500),
          source,
        });
      }
    } catch (error) {
      console.error('[R&D Team] Exploit search failed:', error);
    }

    return exploits;
  }

  // ==========================================================================
  // Nuclei Template Generation
  // ==========================================================================

  /**
   * Generate a Nuclei template using AI inference based on research data.
   */
  async generateNucleiTemplate(
    research: ResearchPackage,
    vulnerabilityId?: string
  ): Promise<TemplateGenerationResult> {
    const { ollamaAIClient } = await import('../ollama-ai-client');

    const identifier = research.cveId || research.service || 'unknown';
    const templateId = `custom-${identifier.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${Date.now()}`;
    const templateName = research.cveId
      ? `Custom ${research.cveId} Detection`
      : `Custom ${research.service || 'Vulnerability'} ${research.version || ''} Detection`.trim();

    const severity = research.severity || 'medium';

    // Build AI prompt
    const systemPrompt = `You are a security researcher specializing in writing Nuclei vulnerability detection templates.
Generate a valid Nuclei YAML template based on the provided vulnerability research.

Rules:
- Output ONLY valid YAML — no markdown fences, no explanations
- Use Nuclei v3.x template syntax
- Include proper id, info (name, author, severity, description, tags), and detection logic
- Use appropriate matchers (status, word, regex, dsl) based on the vulnerability type
- Include references from the research data
- For HTTP-based checks, use the http protocol with appropriate requests
- For network-based checks, use the network protocol
- Set the template id to: ${templateId}
- Set severity to: ${severity}
- The template should detect the vulnerability, NOT exploit it`;

    const userPrompt = `Generate a Nuclei vulnerability detection template for the following:

CVE ID: ${research.cveId || 'N/A'}
Description: ${research.description}
Service: ${research.service || 'N/A'}
Version: ${research.version || 'N/A'}
Severity: ${severity}
CVSS Score: ${research.cvssScore || 'N/A'}
CWE: ${research.cweId || 'N/A'}
Affected Products: ${research.affectedProducts.join(', ') || 'N/A'}
Exploit Methodology: ${research.exploitMethodology.join('; ') || 'N/A'}
References: ${research.references.slice(0, 5).join(', ') || 'N/A'}

Output ONLY the YAML template content.`;

    const aiResponse = await ollamaAIClient.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        temperature: 0.3,
        maxTokens: 4096,
        enrichmentType: 'nuclei_template_generation',
        useCache: false,
      }
    );

    if (!aiResponse.success || !aiResponse.content) {
      throw new Error(`AI template generation failed: ${aiResponse.error || 'No content returned'}`);
    }

    // Clean the YAML content (strip markdown fences if present)
    let yamlContent = aiResponse.content.trim();
    yamlContent = yamlContent.replace(/^```ya?ml\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    // Basic YAML validation: must contain 'id:' and 'info:'
    if (!yamlContent.includes('id:') || !yamlContent.includes('info:')) {
      throw new Error('Generated template is invalid: missing required id or info fields');
    }

    // Map severity for DB enum
    const dbSeverity = this.mapSeverity(severity);

    // Store template in database
    const [templateRecord] = await db
      .insert(nucleiTemplates)
      .values({
        templateId,
        name: templateName,
        severity: dbSeverity,
        category: research.cweId ? this.cweToCategory(research.cweId) : 'custom',
        content: yamlContent,
        isCustom: true,
        generatedByAi: true,
        targetVulnerabilityId: vulnerabilityId || null,
        tags: [
          research.cveId,
          research.service,
          research.cweId,
          'ai-generated',
          'rd-team',
        ].filter(Boolean) as string[],
        metadata: {
          generatedBy: 'rd-team-agent',
          aiProvider: aiResponse.provider,
          aiModel: aiResponse.model,
          tokensUsed: aiResponse.tokensUsed,
          researchResultCount: research.rawResults.length,
          pocCount: research.pocUrls.length,
          generatedAt: new Date().toISOString(),
        },
      })
      .returning();

    console.log(`[R&D Team] Template ${templateId} generated and stored (DB ID: ${templateRecord.id})`);

    return {
      templateId,
      dbId: templateRecord.id,
      yamlContent,
      name: templateName,
      severity: dbSeverity,
    };
  }

  // ==========================================================================
  // Template Deployment
  // ==========================================================================

  /**
   * Deploy a generated template to the rtpi-tools container.
   */
  async deployTemplate(templateId: string, yamlContent: string): Promise<void> {
    const { dockerExecutor } = await import('../docker-executor');

    const containerName = 'rtpi-tools';
    const templateDir = '/home/rtpi-tools/nuclei-templates/custom';
    const templatePath = `${templateDir}/${templateId}.yaml`;

    try {
      // Create custom template directory
      await dockerExecutor.exec(containerName, ['mkdir', '-p', templateDir], {});

      // Write the template file using bash heredoc approach
      await dockerExecutor.exec(
        containerName,
        ['bash', '-c', `cat > ${templatePath} << 'TEMPLATE_EOF'\n${yamlContent}\nTEMPLATE_EOF`],
        {}
      );

      // Verify the file was written
      const verify = await dockerExecutor.exec(
        containerName,
        ['test', '-f', templatePath],
        {}
      );

      if (verify.exitCode !== 0) {
        throw new Error(`Template file not found after deployment: ${templatePath}`);
      }

      // Update file path in database
      await db
        .update(nucleiTemplates)
        .set({ filePath: templatePath })
        .where(eq(nucleiTemplates.templateId, templateId));

      console.log(`[R&D Team] Template deployed to ${templatePath}`);
    } catch (error) {
      console.error(`[R&D Team] Template deployment failed:`, error);
      throw new Error(`Failed to deploy template to container: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==========================================================================
  // Template Validation
  // ==========================================================================

  /**
   * Validate a template by running it against a target using nuclei-executor.
   */
  async validateTemplate(
    templateId: string,
    targetUrl: string,
    operationId?: string
  ): Promise<ValidationResult> {
    const { nucleiExecutor } = await import('../nuclei-executor');

    // Look up the template
    const [template] = await db
      .select()
      .from(nucleiTemplates)
      .where(eq(nucleiTemplates.templateId, templateId))
      .limit(1);

    if (!template) {
      throw new Error(`Template ${templateId} not found in database`);
    }

    const templatePath = template.filePath || `/home/rtpi-tools/nuclei-templates/custom/${templateId}.yaml`;

    console.log(`[R&D Team] Validating template ${templateId} against ${targetUrl}`);

    try {
      // Use nuclei executor to run the template (if we have an operationId)
      // Otherwise, run directly via docker
      if (operationId) {
        const scanResult = await nucleiExecutor.executeScan(
          [targetUrl],
          {
            templates: [templatePath],
            rateLimit: 10,
          },
          operationId,
          'rd-team-agent'
        );

        const findingsCount = scanResult.results.stats.total;
        const validated = findingsCount > 0;

        // Update template validation status
        await db
          .update(nucleiTemplates)
          .set({
            isValidated: true,
            validationResults: {
              targetUrl,
              validated,
              findingsCount,
              scanId: scanResult.scanId,
              validatedAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
          })
          .where(eq(nucleiTemplates.templateId, templateId));

        return {
          templateId,
          targetUrl,
          success: validated,
          findingsCount,
          findings: scanResult.results.vulnerabilities,
        };
      } else {
        // Direct docker execution for validation without an operation
        const { dockerExecutor } = await import('../docker-executor');

        const result = await dockerExecutor.exec(
          'rtpi-tools',
          [
            'nuclei',
            '-u', targetUrl,
            '-t', templatePath,
            '-jsonl',
            '-silent',
            '-rate-limit', '10',
            '-disable-update-check',
          ],
          { timeout: 120000 }
        );

        const findings: any[] = [];
        for (const line of (result.stdout || '').split('\n')) {
          try {
            if (line.trim()) findings.push(JSON.parse(line));
          } catch {
            // Skip non-JSON lines
          }
        }

        const validated = findings.length > 0;

        // Update template validation status
        await db
          .update(nucleiTemplates)
          .set({
            isValidated: true,
            validationResults: {
              targetUrl,
              validated,
              findingsCount: findings.length,
              validatedAt: new Date().toISOString(),
              directExecution: true,
            },
            updatedAt: new Date(),
          })
          .where(eq(nucleiTemplates.templateId, templateId));

        return {
          templateId,
          targetUrl,
          success: validated,
          findingsCount: findings.length,
          findings,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Validation execution failed';

      // Still mark as validated (with failure info)
      await db
        .update(nucleiTemplates)
        .set({
          isValidated: true,
          validationResults: {
            targetUrl,
            validated: false,
            error: errorMsg,
            validatedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(nucleiTemplates.templateId, templateId));

      return {
        templateId,
        targetUrl,
        success: false,
        findingsCount: 0,
        findings: [],
        error: errorMsg,
      };
    }
  }

  // ==========================================================================
  // Blocker Reporting
  // ==========================================================================

  /**
   * Report a blocker to the Operations Manager agent via the message bus.
   */
  private async reportBlocker(task: TaskDefinition, reason: string): Promise<void> {
    console.warn(`[R&D Team] BLOCKER: ${reason}`);

    this.emit('blocker', {
      taskId: task.id,
      taskType: task.taskType,
      reason,
      agentId: this.agentId,
      timestamp: new Date().toISOString(),
    });

    if (this.agentId) {
      try {
        await agentMessageBus.sendMessage({
          messageType: 'status',
          from: { agentId: this.agentId, agentRole: this.agentRole },
          broadcastToRole: 'operations_manager',
          subject: 'R&D Team Blocker',
          content: {
            summary: reason,
            data: {
              taskId: task.id,
              taskType: task.taskType,
              operationId: task.operationId,
            },
          },
        });
      } catch (error) {
        console.error('[R&D Team] Failed to send blocker message:', error);
      }
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Map severity string to DB enum value.
   */
  private mapSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' | 'informational' {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'informational';
    }
  }

  /**
   * Map CWE ID to a Nuclei template category.
   */
  private cweToCategory(cweId: string): string {
    const cweNum = parseInt(cweId.replace('CWE-', ''), 10);
    if (!cweNum) return 'custom';

    // Common CWE to category mappings
    if ([89, 564].includes(cweNum)) return 'sqli';
    if ([79, 80].includes(cweNum)) return 'xss';
    if ([918].includes(cweNum)) return 'ssrf';
    if ([22, 23, 36].includes(cweNum)) return 'lfi';
    if ([78, 77].includes(cweNum)) return 'rce';
    if ([94, 95, 96].includes(cweNum)) return 'code-injection';
    if ([287, 306, 862, 863].includes(cweNum)) return 'auth-bypass';
    if ([611].includes(cweNum)) return 'xxe';
    if ([502].includes(cweNum)) return 'deserialization';
    if ([601].includes(cweNum)) return 'redirect';
    if ([200, 209, 532].includes(cweNum)) return 'exposure';
    if ([352].includes(cweNum)) return 'csrf';

    return 'custom';
  }
}

// Singleton instance
export const rdTeamAgent = new RDTeamAgent();
