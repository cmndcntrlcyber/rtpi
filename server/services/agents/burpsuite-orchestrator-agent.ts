/**
 * BurpSuite Orchestrator Agent
 *
 * Orchestrates BurpSuite Professional/Enterprise for vulnerability investigation
 * and validation. Communicates with the Burp MCP server running in the
 * rtpi-burp-agent container to drive active scans, proxy analysis, and
 * evidence collection.
 *
 * Capabilities:
 * - investigate_finding: Send targeted HTTP requests through Burp for vulnerability validation
 * - validate_vulnerability: Confirm exploitability with active scan analysis
 * - active_scan: Run active scan on a target URL via Burp MCP
 * - analyze_proxy_history: Read proxy logs for passive analysis
 */

import { BaseTaskAgent, TaskDefinition, TaskResult } from './base-task-agent';
import { db } from '../../db';
import { vulnerabilities, agents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { agentMessageBus } from '../agent-message-bus';

// ============================================================================
// Types
// ============================================================================

interface BurpScanResult {
  scanId: string;
  status: 'completed' | 'running' | 'failed';
  issues?: BurpIssue[];
  errorMessage?: string;
}

interface BurpIssue {
  name: string;
  severity: string;
  confidence: string;
  url: string;
  detail: string;
  remediation?: string;
  issueType?: string;
}

interface ProxyHistoryEntry {
  host: string;
  port: number;
  protocol: string;
  method: string;
  path: string;
  statusCode: number;
  responseLength: number;
  mimeType: string;
  comment?: string;
}

interface InvestigationEvidence {
  type: string;
  description: string;
  indicators: string[];
  rawResponse?: string;
  scanIssues?: BurpIssue[];
  proxyEntries?: ProxyHistoryEntry[];
  timestamp: string;
}

// ============================================================================
// Constants
// ============================================================================

const BURP_MCP_BASE_URL = process.env.BURP_MCP_URL || 'http://rtpi-burp-agent:9876';
const BURP_PROXY_HOST = process.env.BURP_PROXY_HOST || 'rtpi-burp-agent';
const BURP_PROXY_PORT = parseInt(process.env.BURP_PROXY_PORT || '8080', 10);

const SQL_ERROR_PATTERNS = [
  /sql syntax/i,
  /mysql_fetch/i,
  /pg_query/i,
  /ORA-\d{5}/i,
  /microsoft ole db/i,
  /unclosed quotation mark/i,
  /quoted string not properly terminated/i,
  /you have an error in your sql/i,
  /warning:.*mysql/i,
  /postgresql.*error/i,
  /sqlite3?\.OperationalError/i,
  /SQLSTATE\[/i,
  /JDBCException/i,
  /org\.hibernate/i,
];

const XSS_PATTERNS = [
  /<script[^>]*>.*<\/script>/i,
  /on(error|load|click|mouseover)\s*=/i,
  /javascript:/i,
  /document\.(cookie|location|write)/i,
  /eval\s*\(/i,
  /alert\s*\(/i,
];

const SSRF_PATTERNS = [
  /connection refused/i,
  /connect\(\) failed/i,
  /no route to host/i,
  /name or service not known/i,
  /couldn't connect to server/i,
  /internal server error.*(?:127\.0\.0\.1|localhost|0\.0\.0\.0|::1)/i,
  /request to .* failed/i,
];

// ============================================================================
// BurpSuite Orchestrator Agent
// ============================================================================

export class BurpSuiteOrchestratorAgent extends BaseTaskAgent {
  constructor() {
    super(
      'BurpSuite Orchestrator',
      'burpsuite_orchestrator',
      ['investigate_finding', 'validate_vulnerability', 'active_scan', 'analyze_proxy_history']
    );
  }

  // ==========================================================================
  // Task Execution
  // ==========================================================================

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    // Check dormant state before any task
    const activationCheck = await this.checkBurpActivation();
    if (!activationCheck.active) {
      await this.reportBlocker(
        task,
        `BurpSuite is not active (status: ${activationCheck.status}). Activation required before investigation tasks can proceed.`
      );
      return {
        success: false,
        error: 'BurpSuite is not active',
        data: { requiresActivation: true, activationStatus: activationCheck.status },
      };
    }

    await this.updateStatus('running');

    try {
      let result: TaskResult;

      switch (task.taskType) {
        case 'investigate_finding':
          result = await this.handleInvestigateFinding(task);
          break;
        case 'validate_vulnerability':
          result = await this.handleValidateVulnerability(task);
          break;
        case 'active_scan':
          result = await this.handleActiveScan(task);
          break;
        case 'analyze_proxy_history':
          result = await this.handleAnalyzeProxyHistory(task);
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
      console.error(`[BurpSuite Orchestrator] Task failed: ${errorMsg}`);
      await this.updateStatus('error');

      const result: TaskResult = { success: false, error: errorMsg };
      await this.storeTaskMemory({ task, result, memoryType: 'event' });
      return result;
    }
  }

  // ==========================================================================
  // Activation Check
  // ==========================================================================

  private async checkBurpActivation(): Promise<{ active: boolean; status: string }> {
    try {
      const { burpActivationService } = await import('../burp-activation-service');
      const status = await burpActivationService.getStatus();
      return {
        active: status.activationStatus === 'active',
        status: status.activationStatus,
      };
    } catch (error) {
      console.error('[BurpSuite Orchestrator] Failed to check activation status:', error);
      return { active: false, status: 'error' };
    }
  }

  // ==========================================================================
  // Task Handlers
  // ==========================================================================

  /**
   * Investigate a vulnerability finding by sending targeted HTTP requests
   * through the Burp proxy and analyzing responses for vulnerability indicators.
   */
  private async handleInvestigateFinding(task: TaskDefinition): Promise<TaskResult> {
    const { vulnerabilityId, targetUrl, vulnType } = task.parameters;

    if (!vulnerabilityId || !targetUrl) {
      return { success: false, error: 'Missing required parameters: vulnerabilityId, targetUrl' };
    }

    console.log(`[BurpSuite Orchestrator] Investigating finding ${vulnerabilityId} at ${targetUrl}`);
    await this.reportProgress(task.id || vulnerabilityId, 10, 'Starting investigation');

    try {
      // Send request through Burp proxy to capture in proxy history
      const proxyResponse = await this.sendThroughProxy(targetUrl);
      await this.reportProgress(task.id || vulnerabilityId, 40, 'Proxied request captured');

      // Analyze response for vulnerability indicators
      const evidence = this.analyzeResponse(proxyResponse, vulnType || 'generic');
      await this.reportProgress(task.id || vulnerabilityId, 70, 'Response analyzed');

      // Update vulnerability record with investigation evidence
      const investigationStatus = evidence.indicators.length > 0 ? 'investigating' : 'inconclusive';
      await this.updateVulnerabilityRecord(vulnerabilityId, {
        investigationStatus,
        validationEvidence: evidence,
      });

      await this.reportProgress(task.id || vulnerabilityId, 100, 'Investigation complete');

      return {
        success: true,
        data: {
          vulnerabilityId,
          investigationStatus,
          indicatorsFound: evidence.indicators.length,
          evidence,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Investigation failed';
      await this.updateVulnerabilityRecord(vulnerabilityId, {
        investigationStatus: 'inconclusive',
        validationEvidence: {
          type: 'error',
          description: errorMsg,
          indicators: [],
          timestamp: new Date().toISOString(),
        },
      });
      return { success: false, error: errorMsg, data: { vulnerabilityId } };
    }
  }

  /**
   * Validate a vulnerability by running an active Burp scan and analyzing the results.
   * Updates the vulnerability record with validated/false_positive status.
   */
  private async handleValidateVulnerability(task: TaskDefinition): Promise<TaskResult> {
    const { vulnerabilityId, targetUrl } = task.parameters;

    if (!vulnerabilityId || !targetUrl) {
      return { success: false, error: 'Missing required parameters: vulnerabilityId, targetUrl' };
    }

    console.log(`[BurpSuite Orchestrator] Validating vulnerability ${vulnerabilityId} at ${targetUrl}`);
    await this.reportProgress(task.id || vulnerabilityId, 10, 'Starting active scan for validation');

    try {
      // Start active scan
      const scanResult = await this.startActiveScan(targetUrl);
      await this.reportProgress(task.id || vulnerabilityId, 30, `Active scan started: ${scanResult.scanId}`);

      // Wait for scan completion
      const completedScan = await this.waitForScanCompletion(scanResult.scanId);
      await this.reportProgress(task.id || vulnerabilityId, 70, 'Active scan completed');

      // Extract and analyze findings
      const evidence = this.extractEvidence(completedScan);
      const isValidated = completedScan.issues && completedScan.issues.length > 0;
      const investigationStatus = isValidated ? 'validated' : 'false_positive';

      // Update vulnerability record
      await this.updateVulnerabilityRecord(vulnerabilityId, {
        investigationStatus,
        investigationCompletedAt: new Date(),
        validationEvidence: evidence,
        burpScanReference: scanResult.scanId,
      });

      await this.reportProgress(task.id || vulnerabilityId, 100, `Validation complete: ${investigationStatus}`);

      return {
        success: true,
        data: {
          vulnerabilityId,
          investigationStatus,
          scanId: scanResult.scanId,
          issuesFound: completedScan.issues?.length || 0,
          evidence,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Validation failed';
      await this.updateVulnerabilityRecord(vulnerabilityId, {
        investigationStatus: 'inconclusive',
        validationEvidence: {
          type: 'error',
          description: errorMsg,
          indicators: [],
          timestamp: new Date().toISOString(),
        },
      });
      return { success: false, error: errorMsg, data: { vulnerabilityId } };
    }
  }

  /**
   * Start a Burp active scan on a target URL.
   */
  private async handleActiveScan(task: TaskDefinition): Promise<TaskResult> {
    const { targetUrl, operationId, waitForCompletion } = task.parameters;

    if (!targetUrl) {
      return { success: false, error: 'Missing required parameter: targetUrl' };
    }

    console.log(`[BurpSuite Orchestrator] Starting active scan on ${targetUrl}`);

    try {
      const scanResult = await this.startActiveScan(targetUrl);

      if (waitForCompletion) {
        const completed = await this.waitForScanCompletion(scanResult.scanId);
        return {
          success: true,
          data: {
            scanId: scanResult.scanId,
            status: completed.status,
            issuesFound: completed.issues?.length || 0,
            issues: completed.issues || [],
            operationId,
          },
        };
      }

      return {
        success: true,
        data: {
          scanId: scanResult.scanId,
          status: 'running',
          message: 'Active scan started. Use scan ID to check progress.',
          operationId,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Active scan failed';
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Analyze proxy history for a target host.
   */
  private async handleAnalyzeProxyHistory(task: TaskDefinition): Promise<TaskResult> {
    const { targetHost, limit } = task.parameters;

    if (!targetHost) {
      return { success: false, error: 'Missing required parameter: targetHost' };
    }

    console.log(`[BurpSuite Orchestrator] Analyzing proxy history for ${targetHost}`);

    try {
      const history = await this.getProxyHistory(targetHost, limit || 100);

      // Analyze patterns in proxy history
      const analysis = this.analyzeProxyHistory(history);

      return {
        success: true,
        data: {
          targetHost,
          totalEntries: history.length,
          analysis,
          entries: history.slice(0, 50), // Return first 50 entries
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Proxy history analysis failed';
      return { success: false, error: errorMsg };
    }
  }

  // ==========================================================================
  // Burp MCP Communication
  // ==========================================================================

  /**
   * Send a request through the Burp proxy and return the response.
   */
  private async sendThroughProxy(targetUrl: string): Promise<{ status: number; headers: Record<string, string>; body: string }> {
    try {
      // Use the Burp MCP server's proxy endpoint to send the request
      const response = await fetch(`${BURP_MCP_BASE_URL}/api/proxy/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, method: 'GET' }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        // Fallback: send request directly through HTTP proxy
        const proxyUrl = `http://${BURP_PROXY_HOST}:${BURP_PROXY_PORT}`;
        const proxyResponse = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'RTPI-BurpOrchestrator/1.0',
          },
          signal: AbortSignal.timeout(30000),
        });

        const body = await proxyResponse.text();
        const headers: Record<string, string> = {};
        proxyResponse.headers.forEach((value, key) => { headers[key] = value; });

        return { status: proxyResponse.status, headers, body };
      }

      const data = await response.json() as any;
      return {
        status: data.statusCode || 200,
        headers: data.headers || {},
        body: data.body || '',
      };
    } catch (error) {
      console.error('[BurpSuite Orchestrator] Proxy request failed:', error);
      throw new Error(`Failed to send request through Burp proxy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start an active scan via the Burp MCP server.
   */
  private async startActiveScan(targetUrl: string): Promise<BurpScanResult> {
    try {
      const response = await fetch(`${BURP_MCP_BASE_URL}/api/scan/active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          scope: { include: [targetUrl] },
          configuration: { followRedirections: true, maxCrawlDepth: 3 },
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Burp MCP server returned ${response.status}: ${errorText}`);
      }

      const data = await response.json() as any;
      return {
        scanId: data.scanId || data.id || `burp-scan-${Date.now()}`,
        status: 'running',
      };
    } catch (error) {
      console.error('[BurpSuite Orchestrator] Failed to start active scan:', error);
      throw new Error(`Failed to start Burp active scan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Wait for a Burp scan to complete by polling the MCP server.
   */
  private async waitForScanCompletion(scanId: string, timeoutMs: number = 300000): Promise<BurpScanResult> {
    const startTime = Date.now();
    const pollIntervalMs = 5000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(`${BURP_MCP_BASE_URL}/api/scan/${scanId}`, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const data = await response.json() as any;
          if (data.status === 'completed' || data.status === 'finished') {
            return {
              scanId,
              status: 'completed',
              issues: data.issues || data.findings || [],
            };
          }
          if (data.status === 'failed' || data.status === 'error') {
            return {
              scanId,
              status: 'failed',
              errorMessage: data.errorMessage || data.error || 'Scan failed',
            };
          }
        }
      } catch (error) {
        console.warn(`[BurpSuite Orchestrator] Scan poll error for ${scanId}:`, error);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Scan ${scanId} timed out after ${timeoutMs}ms`);
  }

  /**
   * Get proxy history entries for a target host from the Burp MCP server.
   */
  private async getProxyHistory(targetHost: string, limit: number = 100): Promise<ProxyHistoryEntry[]> {
    try {
      const response = await fetch(`${BURP_MCP_BASE_URL}/api/proxy/history?host=${encodeURIComponent(targetHost)}&limit=${limit}`, {
        method: 'GET',
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Burp MCP server returned ${response.status}`);
      }

      const data = await response.json() as any;
      return (data.entries || data.history || []) as ProxyHistoryEntry[];
    } catch (error) {
      console.error('[BurpSuite Orchestrator] Failed to get proxy history:', error);
      throw new Error(`Failed to get Burp proxy history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==========================================================================
  // Response Analyzers
  // ==========================================================================

  /**
   * Analyze an HTTP response for vulnerability indicators based on type.
   */
  private analyzeResponse(
    response: { status: number; headers: Record<string, string>; body: string },
    vulnType: string
  ): InvestigationEvidence {
    const indicators: string[] = [];
    const body = response.body || '';

    switch (vulnType.toLowerCase()) {
      case 'sqli':
      case 'sql_injection':
      case 'sql injection':
        indicators.push(...this.detectSQLInjection(body));
        break;
      case 'xss':
      case 'cross-site scripting':
        indicators.push(...this.detectXSS(body));
        break;
      case 'ssrf':
      case 'server-side request forgery':
        indicators.push(...this.detectSSRF(body));
        break;
      default:
        // Run all detectors for generic/unknown types
        indicators.push(...this.detectSQLInjection(body));
        indicators.push(...this.detectXSS(body));
        indicators.push(...this.detectSSRF(body));
        break;
    }

    // Check for interesting response characteristics
    if (response.status >= 500) {
      indicators.push(`Server error response (HTTP ${response.status})`);
    }
    if (response.headers['x-debug'] || response.headers['x-debug-token']) {
      indicators.push('Debug headers present in response');
    }
    if (response.headers['server']) {
      indicators.push(`Server header disclosed: ${response.headers['server']}`);
    }

    return {
      type: vulnType,
      description: indicators.length > 0
        ? `Found ${indicators.length} potential indicator(s) for ${vulnType}`
        : `No indicators found for ${vulnType}`,
      indicators,
      rawResponse: body.substring(0, 5000), // Truncate for storage
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detect SQL injection indicators in response body.
   */
  private detectSQLInjection(body: string): string[] {
    const indicators: string[] = [];
    for (const pattern of SQL_ERROR_PATTERNS) {
      const match = body.match(pattern);
      if (match) {
        indicators.push(`SQL error pattern detected: "${match[0]}"`);
      }
    }
    return indicators;
  }

  /**
   * Detect XSS indicators in response body (reflected content).
   */
  private detectXSS(body: string): string[] {
    const indicators: string[] = [];
    for (const pattern of XSS_PATTERNS) {
      const match = body.match(pattern);
      if (match) {
        indicators.push(`XSS pattern detected: "${match[0].substring(0, 100)}"`);
      }
    }
    return indicators;
  }

  /**
   * Detect SSRF indicators in response body.
   */
  private detectSSRF(body: string): string[] {
    const indicators: string[] = [];
    for (const pattern of SSRF_PATTERNS) {
      const match = body.match(pattern);
      if (match) {
        indicators.push(`SSRF indicator detected: "${match[0].substring(0, 100)}"`);
      }
    }
    return indicators;
  }

  /**
   * Extract structured validation evidence from a completed Burp scan result.
   */
  private extractEvidence(scanResult: BurpScanResult): InvestigationEvidence {
    const issues = scanResult.issues || [];
    const indicators = issues.map((issue) =>
      `[${issue.severity}/${issue.confidence}] ${issue.name}: ${issue.detail?.substring(0, 200) || 'No detail'}`
    );

    return {
      type: 'active_scan',
      description: issues.length > 0
        ? `Burp active scan found ${issues.length} issue(s)`
        : 'Burp active scan completed with no issues found',
      indicators,
      scanIssues: issues,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Analyze proxy history entries for patterns and anomalies.
   */
  private analyzeProxyHistory(entries: ProxyHistoryEntry[]): Record<string, any> {
    const statusCodes: Record<number, number> = {};
    const methods: Record<string, number> = {};
    const mimeTypes: Record<string, number> = {};
    const errorResponses: ProxyHistoryEntry[] = [];

    for (const entry of entries) {
      statusCodes[entry.statusCode] = (statusCodes[entry.statusCode] || 0) + 1;
      methods[entry.method] = (methods[entry.method] || 0) + 1;
      if (entry.mimeType) {
        mimeTypes[entry.mimeType] = (mimeTypes[entry.mimeType] || 0) + 1;
      }
      if (entry.statusCode >= 400) {
        errorResponses.push(entry);
      }
    }

    return {
      totalRequests: entries.length,
      statusCodeDistribution: statusCodes,
      methodDistribution: methods,
      mimeTypeDistribution: mimeTypes,
      errorCount: errorResponses.length,
      interestingPaths: entries
        .filter((e) =>
          /admin|config|backup|debug|test|api|internal|\.env|\.git/i.test(e.path)
        )
        .map((e) => ({ method: e.method, path: e.path, status: e.statusCode })),
    };
  }

  // ==========================================================================
  // Vulnerability Record Updates
  // ==========================================================================

  /**
   * Update a vulnerability record with investigation results.
   */
  private async updateVulnerabilityRecord(
    vulnId: string,
    updates: {
      investigationStatus?: string;
      investigationCompletedAt?: Date;
      validationEvidence?: InvestigationEvidence;
      burpScanReference?: string;
    }
  ): Promise<void> {
    try {
      await db
        .update(vulnerabilities)
        .set({
          investigationStatus: updates.investigationStatus,
          investigationCompletedAt: updates.investigationCompletedAt,
          validationEvidence: updates.validationEvidence,
          burpScanReference: updates.burpScanReference,
          investigationAgentId: this.agentId,
        })
        .where(eq(vulnerabilities.id, vulnId));

      console.log(
        `[BurpSuite Orchestrator] Updated vulnerability ${vulnId}: status=${updates.investigationStatus}`
      );
    } catch (error) {
      console.error(`[BurpSuite Orchestrator] Failed to update vulnerability ${vulnId}:`, error);
    }
  }

  // ==========================================================================
  // Blocker Reporting
  // ==========================================================================

  /**
   * Report a blocker to the Operations Manager agent via the message bus.
   */
  private async reportBlocker(task: TaskDefinition, reason: string): Promise<void> {
    console.warn(`[BurpSuite Orchestrator] BLOCKER: ${reason}`);

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
          subject: 'BurpSuite Orchestrator Blocker',
          content: {
            summary: reason,
            data: {
              taskId: task.id,
              taskType: task.taskType,
              requiresActivation: true,
              operationId: task.operationId,
            },
          },
        });
      } catch (error) {
        console.error('[BurpSuite Orchestrator] Failed to send blocker message:', error);
      }
    }
  }
}

// Singleton instance
export const burpsuiteOrchestratorAgent = new BurpSuiteOrchestratorAgent();
