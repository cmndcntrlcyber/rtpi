/**
 * Research Agent (v2.4.1)
 *
 * Dedicated multi-phase vulnerability research pipeline that produces
 * VulnerabilityResearchPackages for the Maldev Agent's exploit development.
 *
 * Pipeline:
 *   Phase 1: CVE Discovery — identify CVEs from service/version info via Tavily
 *   Phase 2: Exploit Intelligence — gather PoC code, exploit techniques, payloads
 *   Phase 3: Attack Methodology — synthesize findings into actionable attack plan
 *
 * Routes:
 *   Receives 'vulnerability_research' from agent-workflow-orchestrator (when no MSF module found)
 *   Sends 'exploit_development' to maldev-agent with VulnerabilityResearchPackage
 */

import { BaseTaskAgent, TaskDefinition, TaskResult } from './base-task-agent';
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

export interface VulnerabilityResearchPackage {
  vulnerabilityId?: string;
  operationId?: string;
  targetId?: string;

  // Phase 1: CVE Discovery
  cves: Array<{
    id: string;
    description: string;
    severity: string;
    cvssScore?: number;
    publishedDate?: string;
    affectedProducts: string[];
  }>;

  // Phase 2: Exploit Intelligence
  exploits: Array<{
    source: string;
    url: string;
    type: string; // 'poc', 'exploit-db', 'github', 'metasploit', 'nuclei'
    language?: string;
    code?: string;
    description: string;
    reliability: 'high' | 'medium' | 'low';
  }>;

  // Phase 3: Attack Methodology
  methodology: {
    attackVector: string;
    prerequisites: string[];
    steps: string[];
    payloadType?: string;
    targetOS?: string;
    recommendedApproach: string;
    riskLevel: string;
    evasionNotes: string[];
  };

  // Metadata
  service: string;
  version?: string;
  port?: number;
  researchTimestamp: string;
  tavilyQueries: string[];
  totalSources: number;
}

// ============================================================================
// Research Agent
// ============================================================================

export class ResearchAgent extends BaseTaskAgent {
  private tavilyApiKey: string | null;

  constructor() {
    super(
      'Vulnerability Research Agent',
      'research_agent',
      ['vulnerability_research', 'cve_discovery', 'exploit_intelligence', 'attack_methodology']
    );
    this.tavilyApiKey = process.env.TAVILY_API_KEY || null;
  }

  // ==========================================================================
  // Task Execution
  // ==========================================================================

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    await this.updateStatus('running');

    try {
      let result: TaskResult;

      switch (task.taskType) {
        case 'vulnerability_research':
          result = await this.handleFullResearch(task);
          break;
        case 'cve_discovery':
          result = await this.handleCVEDiscovery(task);
          break;
        case 'exploit_intelligence':
          result = await this.handleExploitIntelligence(task);
          break;
        case 'attack_methodology':
          result = await this.handleAttackMethodology(task);
          break;
        default:
          result = { success: false, error: `Unknown task type: ${task.taskType}` };
      }

      await this.storeTaskMemory({ task, result, memoryType: 'event' });
      await this.updateStatus('idle');
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Research Agent] Task failed: ${errorMsg}`);
      await this.updateStatus('error');
      return { success: false, error: errorMsg };
    }
  }

  // ==========================================================================
  // Full Research Pipeline
  // ==========================================================================

  private async handleFullResearch(task: TaskDefinition): Promise<TaskResult> {
    const { service, version, port, vulnerabilityId, operationId, targetId, cveId } = task.parameters;

    if (!service && !cveId) {
      return { success: false, error: 'Missing required parameter: service or cveId' };
    }

    console.log(`[Research Agent] Starting full research pipeline for: ${cveId || `${service} ${version || ''}`}`);
    await this.reportProgress(task.id || 'research', 5, 'Starting research pipeline');

    const allQueries: string[] = [];
    const researchPackage: VulnerabilityResearchPackage = {
      vulnerabilityId,
      operationId,
      targetId,
      cves: [],
      exploits: [],
      methodology: {
        attackVector: '',
        prerequisites: [],
        steps: [],
        recommendedApproach: '',
        riskLevel: 'unknown',
        evasionNotes: [],
      },
      service: service || 'unknown',
      version,
      port: port ? parseInt(port, 10) : undefined,
      researchTimestamp: new Date().toISOString(),
      tavilyQueries: [],
      totalSources: 0,
    };

    // Phase 1: CVE Discovery
    await this.reportProgress(task.id || 'research', 15, 'Phase 1: CVE Discovery');
    const cveResults = await this.discoverCVEs(service, version, cveId);
    researchPackage.cves = cveResults.cves;
    allQueries.push(...cveResults.queries);

    // Phase 2: Exploit Intelligence
    await this.reportProgress(task.id || 'research', 45, 'Phase 2: Exploit Intelligence');
    const exploitResults = await this.gatherExploitIntel(
      service, version, researchPackage.cves.map(c => c.id)
    );
    researchPackage.exploits = exploitResults.exploits;
    allQueries.push(...exploitResults.queries);

    // Phase 3: Attack Methodology
    await this.reportProgress(task.id || 'research', 75, 'Phase 3: Attack Methodology');
    researchPackage.methodology = this.synthesizeMethodology(
      researchPackage.cves,
      researchPackage.exploits,
      service,
      version,
      port
    );

    researchPackage.tavilyQueries = allQueries;
    researchPackage.totalSources = researchPackage.cves.length + researchPackage.exploits.length;

    // Route to maldev-agent if exploits found
    if (researchPackage.exploits.length > 0) {
      await this.routeToMaldevAgent(researchPackage);
    }

    await this.reportProgress(task.id || 'research', 100, 'Research pipeline complete');

    return {
      success: true,
      data: {
        researchPackage,
        summary: `Found ${researchPackage.cves.length} CVEs, ${researchPackage.exploits.length} exploits for ${service} ${version || ''}`,
      },
    };
  }

  // ==========================================================================
  // Phase 1: CVE Discovery
  // ==========================================================================

  private async handleCVEDiscovery(task: TaskDefinition): Promise<TaskResult> {
    const { service, version, cveId } = task.parameters;
    const results = await this.discoverCVEs(service, version, cveId);
    return {
      success: results.cves.length > 0,
      data: { cves: results.cves, queries: results.queries },
    };
  }

  private async discoverCVEs(
    service?: string,
    version?: string,
    knownCveId?: string
  ): Promise<{ cves: VulnerabilityResearchPackage['cves']; queries: string[] }> {
    const queries: string[] = [];
    const cves: VulnerabilityResearchPackage['cves'] = [];

    if (!this.tavilyApiKey) {
      console.warn('[Research Agent] Tavily API key not configured');
      return { cves, queries };
    }

    // Build search queries
    if (knownCveId) {
      queries.push(`${knownCveId} vulnerability details CVSS affected products`);
      queries.push(`${knownCveId} exploit proof of concept`);
    }
    if (service) {
      const serviceVersion = version ? `${service} ${version}` : service;
      queries.push(`${serviceVersion} CVE vulnerability 2024 2025`);
      if (version) {
        queries.push(`${serviceVersion} remote code execution vulnerability`);
      }
    }

    // Execute Tavily searches
    for (const query of queries.slice(0, 4)) {
      try {
        const response = await this.tavilySearch(query, 'advanced', 8);
        if (!response) continue;

        // Parse CVEs from results
        for (const result of response.results) {
          const cveMatches = (result.content || '').match(/CVE-\d{4}-\d{4,}/g);
          if (cveMatches) {
            for (const cveMatch of [...new Set(cveMatches)]) {
              if (!cves.find(c => c.id === cveMatch)) {
                cves.push({
                  id: cveMatch,
                  description: this.extractCVEDescription(result.content, cveMatch),
                  severity: this.inferSeverity(result.content),
                  affectedProducts: this.extractAffectedProducts(result.content),
                });
              }
            }
          }
        }
      } catch (error) {
        console.error(`[Research Agent] CVE discovery search failed for: ${query}`, error);
      }
    }

    return { cves, queries };
  }

  // ==========================================================================
  // Phase 2: Exploit Intelligence
  // ==========================================================================

  private async handleExploitIntelligence(task: TaskDefinition): Promise<TaskResult> {
    const { service, version, cveIds } = task.parameters;
    const results = await this.gatherExploitIntel(service, version, cveIds || []);
    return {
      success: results.exploits.length > 0,
      data: { exploits: results.exploits, queries: results.queries },
    };
  }

  private async gatherExploitIntel(
    service?: string,
    version?: string,
    cveIds: string[] = []
  ): Promise<{ exploits: VulnerabilityResearchPackage['exploits']; queries: string[] }> {
    const queries: string[] = [];
    const exploits: VulnerabilityResearchPackage['exploits'] = [];

    if (!this.tavilyApiKey) return { exploits, queries };

    // Build exploit-focused queries
    for (const cve of cveIds.slice(0, 3)) {
      queries.push(`${cve} exploit PoC proof of concept github`);
      queries.push(`${cve} metasploit module exploit-db`);
    }
    if (service) {
      const sv = version ? `${service} ${version}` : service;
      queries.push(`${sv} exploit payload remote shell`);
    }

    for (const query of queries.slice(0, 5)) {
      try {
        const response = await this.tavilySearch(query, 'advanced', 5);
        if (!response) continue;

        for (const result of response.results) {
          const exploit = this.classifyExploitSource(result);
          if (exploit) {
            exploits.push(exploit);
          }
        }
      } catch (error) {
        console.error(`[Research Agent] Exploit intel search failed for: ${query}`, error);
      }
    }

    return { exploits, queries };
  }

  // ==========================================================================
  // Phase 3: Attack Methodology Synthesis
  // ==========================================================================

  private async handleAttackMethodology(task: TaskDefinition): Promise<TaskResult> {
    const { cves, exploits, service, version, port } = task.parameters;
    const methodology = this.synthesizeMethodology(cves || [], exploits || [], service, version, port);
    return { success: true, data: { methodology } };
  }

  private synthesizeMethodology(
    cves: VulnerabilityResearchPackage['cves'],
    exploits: VulnerabilityResearchPackage['exploits'],
    service?: string,
    version?: string,
    port?: number | string
  ): VulnerabilityResearchPackage['methodology'] {
    const hasRCE = exploits.some(e =>
      e.description.toLowerCase().includes('remote code execution') ||
      e.description.toLowerCase().includes('rce')
    );
    const hasSQLi = exploits.some(e =>
      e.description.toLowerCase().includes('sql injection')
    );
    const hasAuthBypass = exploits.some(e =>
      e.description.toLowerCase().includes('authentication bypass') ||
      e.description.toLowerCase().includes('auth bypass')
    );

    const steps: string[] = [];
    const prerequisites: string[] = [];
    let attackVector = 'network';
    let recommendedApproach = '';
    let payloadType: string | undefined;

    // Determine attack vector and build steps
    if (hasRCE) {
      attackVector = 'network';
      payloadType = 'reverse_shell';
      prerequisites.push(`Target running ${service || 'vulnerable service'}${version ? ` ${version}` : ''}`);
      prerequisites.push(`Network access to port ${port || 'target port'}`);
      steps.push(`Verify service version on port ${port || '?'}`);
      steps.push('Select exploit matching exact version');
      steps.push('Configure payload (reverse shell / meterpreter)');
      steps.push('Set up multi/handler listener');
      steps.push('Launch exploit');
      steps.push('Establish persistence if authorized');
      recommendedApproach = 'RCE exploit with staged meterpreter payload';
    } else if (hasSQLi) {
      attackVector = 'network';
      payloadType = 'sqli_extraction';
      prerequisites.push('Web application accessible');
      steps.push('Identify injection point');
      steps.push('Determine database type');
      steps.push('Extract schema information');
      steps.push('Dump credentials or sensitive data');
      steps.push('Attempt OS command execution via DB');
      recommendedApproach = 'SQL injection with data exfiltration and OS command execution';
    } else if (hasAuthBypass) {
      attackVector = 'network';
      prerequisites.push('Authentication endpoint accessible');
      steps.push('Test authentication bypass technique');
      steps.push('Enumerate accessible resources');
      steps.push('Escalate privileges if possible');
      recommendedApproach = 'Authentication bypass with privilege escalation';
    } else if (exploits.length > 0) {
      prerequisites.push(`Target service accessible on port ${port || '?'}`);
      steps.push('Verify vulnerability exists on target');
      steps.push('Adapt exploit for target environment');
      steps.push('Execute exploit with appropriate payload');
      recommendedApproach = 'Generic exploit execution based on available PoC';
    } else {
      steps.push('Manual verification required - no automated exploits found');
      steps.push('Consider fuzzing or manual testing');
      recommendedApproach = 'Manual testing - no reliable exploits available';
    }

    // Determine risk level from CVE severity
    const maxSeverity = cves.reduce((max, cve) => {
      const sevMap: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      return Math.max(max, sevMap[cve.severity] || 0);
    }, 0);
    const riskLevel = maxSeverity >= 4 ? 'critical' : maxSeverity >= 3 ? 'high' :
      maxSeverity >= 2 ? 'medium' : 'low';

    return {
      attackVector,
      prerequisites,
      steps,
      payloadType,
      recommendedApproach,
      riskLevel,
      evasionNotes: [
        'Use encrypted channels for C2 communication',
        'Avoid triggering IDS/IPS signatures',
        'Consider time-based execution to avoid anomaly detection',
      ],
    };
  }

  // ==========================================================================
  // Inter-Agent Routing
  // ==========================================================================

  private async routeToMaldevAgent(pkg: VulnerabilityResearchPackage): Promise<void> {
    try {
      await agentMessageBus.sendMessage({
        fromAgentId: this.agentId || 'research-agent',
        toAgentId: 'maldev-agent',
        messageType: 'task_assignment',
        payload: {
          taskType: 'exploit_development',
          taskName: `Develop exploit for ${pkg.service} ${pkg.version || ''}`,
          parameters: { researchPackage: pkg },
        },
        priority: pkg.methodology.riskLevel === 'critical' ? 1 : 2,
      });
      console.log(`[Research Agent] Routed research package to maldev-agent for ${pkg.service}`);
    } catch (error) {
      console.error('[Research Agent] Failed to route to maldev-agent:', error);
    }
  }

  // ==========================================================================
  // Tavily Search Helper
  // ==========================================================================

  private async tavilySearch(
    query: string,
    depth: 'basic' | 'advanced' = 'advanced',
    maxResults = 5
  ): Promise<TavilyResponse | null> {
    if (!this.tavilyApiKey) return null;

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.tavilyApiKey,
          query,
          search_depth: depth,
          max_results: maxResults,
        }),
      });

      if (!response.ok) {
        console.warn(`[Research Agent] Tavily returned ${response.status} for: ${query}`);
        return null;
      }

      return await response.json() as TavilyResponse;
    } catch (error) {
      console.error(`[Research Agent] Tavily search error: ${error}`);
      return null;
    }
  }

  // ==========================================================================
  // Parsing Helpers
  // ==========================================================================

  private extractCVEDescription(content: string, cveId: string): string {
    // Find sentences mentioning the CVE
    const sentences = content.split(/[.!]\s+/);
    const relevant = sentences.filter(s => s.includes(cveId));
    if (relevant.length > 0) {
      return relevant[0].trim().slice(0, 500);
    }
    return `Vulnerability ${cveId} found during research`;
  }

  private inferSeverity(content: string): string {
    const lower = content.toLowerCase();
    if (lower.includes('critical') || lower.includes('cvss 9') || lower.includes('cvss: 9') || lower.includes('cvss 10')) return 'critical';
    if (lower.includes('high') || lower.includes('cvss 7') || lower.includes('cvss 8')) return 'high';
    if (lower.includes('medium') || lower.includes('cvss 4') || lower.includes('cvss 5') || lower.includes('cvss 6')) return 'medium';
    if (lower.includes('low')) return 'low';
    return 'medium';
  }

  private extractAffectedProducts(content: string): string[] {
    const products: string[] = [];
    // Look for common version patterns
    const versionPatterns = content.match(/[\w-]+\s+(?:version\s+)?[\d]+\.[\d]+(?:\.[\d]+)?/gi);
    if (versionPatterns) {
      products.push(...versionPatterns.slice(0, 5));
    }
    return [...new Set(products)];
  }

  private classifyExploitSource(result: TavilySearchResult): VulnerabilityResearchPackage['exploits'][0] | null {
    const url = result.url.toLowerCase();
    const content = result.content || '';

    let type: string;
    let reliability: 'high' | 'medium' | 'low';

    if (url.includes('exploit-db.com')) {
      type = 'exploit-db';
      reliability = 'high';
    } else if (url.includes('github.com') && (content.toLowerCase().includes('poc') || content.toLowerCase().includes('exploit'))) {
      type = 'github';
      reliability = 'medium';
    } else if (url.includes('rapid7.com') || content.toLowerCase().includes('metasploit')) {
      type = 'metasploit';
      reliability = 'high';
    } else if (content.toLowerCase().includes('nuclei') || content.toLowerCase().includes('template')) {
      type = 'nuclei';
      reliability = 'medium';
    } else if (content.toLowerCase().includes('proof of concept') || content.toLowerCase().includes('poc')) {
      type = 'poc';
      reliability = 'low';
    } else {
      return null; // Not an exploit source
    }

    // Detect language from content
    let language: string | undefined;
    if (content.includes('python') || content.includes('.py')) language = 'python';
    else if (content.includes('ruby') || content.includes('.rb')) language = 'ruby';
    else if (content.includes('bash') || content.includes('curl')) language = 'bash';

    return {
      source: result.title,
      url: result.url,
      type,
      language,
      description: content.slice(0, 500),
      reliability,
    };
  }
}

// Singleton export
export const researchAgent = new ResearchAgent();
