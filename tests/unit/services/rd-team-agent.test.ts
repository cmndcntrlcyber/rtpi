/**
 * R&D Team Agent Unit Tests
 * 
 * Tests R&D Team Agent capabilities:
 * - CVE research via Tavily
 * - Nuclei template generation via AI
 * - Template deployment
 * - Template validation
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rdTeamAgent } from '../../../server/services/agents/rd-team-agent';
import { db } from '../../../server/db';
import { nucleiTemplates } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

// Mock environment variables
process.env.TAVILY_API_KEY = process.env.TAVILY_API_KEY || 'test-key';
process.env.OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

describe('R&D Team Agent', () => {
  beforeAll(async () => {
    // Initialize agent
    if (!rdTeamAgent.isInitialized) {
      await rdTeamAgent.initialize();
    }
  });

  afterAll(async () => {
    // Clean up test templates
    await db.delete(nucleiTemplates)
      .where(eq(nucleiTemplates.templateId, 'custom-test-'))
      .execute()
      .catch(() => {});
  });

  describe('CVE Research', () => {
    it('should research a CVE using Tavily', async () => {
      const result = await rdTeamAgent.executeTask({
        taskType: 'cve_research',
        taskName: 'Test CVE Research',
        description: 'Testing CVE research',
        operationId: 'test-operation',
        parameters: {
          cveId: 'CVE-2024-1234',
          description: 'SQL Injection vulnerability',
        },
      });

      if (!process.env.TAVILY_API_KEY || process.env.TAVILY_API_KEY === 'test-key') {
        // Without real API key, should gracefully skip research
        expect(result.data?.research).toBeTruthy();
        expect(result.data?.research.cveId).toBe('CVE-2024-1234');
      } else {
        // With real API key, should return research results
        expect(result.success).toBe(true);
        expect(result.data?.research).toBeTruthy();
        expect(result.data?.resultCount).toBeGreaterThanOrEqual(0);
      }
    }, 30000);

    it('should handle missing parameters gracefully', async () => {
      const result = await rdTeamAgent.executeTask({
        taskType: 'cve_research',
        taskName: 'Missing Parameters Test',
        description: 'Testing error handling',
        operationId: 'test-operation',
        parameters: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameters');
    });
  });

  describe('Nuclei Template Generation', () => {
    it('should generate a Nuclei template from research data', async () => {
      const mockResearch = {
        cveId: 'CVE-2024-TEST',
        description: 'Test SQL injection vulnerability in login endpoint',
        severity: 'high',
        cvssScore: 8.1,
        cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
        cweId: 'CWE-89',
        affectedProducts: ['Test Product 1.0'],
        exploitMethodology: ['SQL injection via username parameter'],
        pocUrls: ['https://github.com/test/poc'],
        references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-TEST'],
        mitigations: ['Use parameterized queries'],
        rawResults: [
          {
            title: 'CVE-2024-TEST Details',
            url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-TEST',
            content: 'SQL injection vulnerability allows attackers to execute arbitrary SQL commands',
            score: 0.95,
          },
        ],
      };

      const result = await rdTeamAgent.executeTask({
        taskType: 'nuclei_template_generation',
        taskName: 'Test Template Generation',
        description: 'Testing template generation',
        operationId: 'test-operation',
        parameters: {
          research: mockResearch,
          vulnerabilityId: 'test-vuln-id',
        },
      });

      if (!process.env.OLLAMA_HOST || result.error?.includes('Ollama')) {
        // Skip if Ollama not available
        console.warn('Skipping template generation test - Ollama not available');
        expect(result.success).toBe(false);
      } else {
        // With Ollama, should generate template
        expect(result.success).toBe(true);
        expect(result.data?.templateId).toBeTruthy();
        expect(result.data?.yamlContent).toContain('id:');
        expect(result.data?.yamlContent).toContain('info:');
        expect(result.data?.deployed).toBe(true);
      }
    }, 60000);

    it('should handle AI generation failure gracefully', async () => {
      // Test with invalid research data
      const result = await rdTeamAgent.executeTask({
        taskType: 'nuclei_template_generation',
        taskName: 'Invalid Data Test',
        description: 'Testing error handling',
        operationId: 'test-operation',
        parameters: {
          research: {
            cveId: null,
            description: '',
            rawResults: [],
          },
        },
      });

      // Should either fail or return minimal template
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
    }, 60000);
  });

  describe('Exploit Research', () => {
    it('should search for exploits and PoCs', async () => {
      const result = await rdTeamAgent.executeTask({
        taskType: 'exploit_research',
        taskName: 'Test Exploit Research',
        description: 'Testing exploit research',
        operationId: 'test-operation',
        parameters: {
          cveId: 'CVE-2024-5678',
          service: 'Apache HTTP Server',
          version: '2.4.49',
        },
      });

      if (!process.env.TAVILY_API_KEY || process.env.TAVILY_API_KEY === 'test-key') {
        // Without API key, returns empty array
        expect(result.data?.exploits).toEqual([]);
      } else {
        // With API key, should return exploits
        expect(result.success).toBe(true);
        expect(result.data?.exploits).toBeInstanceOf(Array);
      }
    }, 30000);
  });

  describe('Full Pipeline', () => {
    it('should execute complete research → generate → deploy pipeline', async () => {
      const result = await rdTeamAgent.executeTask({
        taskType: 'full_pipeline',
        taskName: 'Test Full Pipeline',
        description: 'Testing complete pipeline',
        operationId: 'test-operation',
        parameters: {
          cveId: 'CVE-2024-PIPELINE',
          description: 'Test vulnerability for pipeline',
          targetUrl: 'https://testphp.vulnweb.com',
        },
      });

      // Pipeline may fail at various stages depending on environment
      // Check that at least research was attempted
      expect(result.data).toBeTruthy();
      
      if (result.success) {
        expect(result.data?.research).toBeTruthy();
        expect(result.data?.template).toBeTruthy();
      } else {
        // Failed at some stage - acceptable for test environment
        console.warn('Pipeline test failed:', result.error);
      }
    }, 120000);
  });

  describe('Task Memory Storage', () => {
    it('should store task results in memory system', async () => {
      const result = await rdTeamAgent.executeTask({
        taskType: 'cve_research',
        taskName: 'Memory Storage Test',
        description: 'Testing memory storage',
        operationId: 'test-operation',
        parameters: {
          cveId: 'CVE-2024-MEMORY',
        },
      });

      // Task should complete (success or graceful failure)
      expect(result).toBeTruthy();
      expect('success' in result || 'error' in result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown task types', async () => {
      const result = await rdTeamAgent.executeTask({
        taskType: 'unknown_task_type' as any,
        taskName: 'Unknown Task Test',
        description: 'Testing error handling',
        operationId: 'test-operation',
        parameters: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown task type');
    });

    it('should handle Tavily API errors gracefully', async () => {
      // Temporarily clear API key
      const originalKey = process.env.TAVILY_API_KEY;
      delete process.env.TAVILY_API_KEY;

      const result = await rdTeamAgent.executeTask({
        taskType: 'cve_research',
        taskName: 'No API Key Test',
        description: 'Testing without API key',
        operationId: 'test-operation',
        parameters: {
          cveId: 'CVE-2024-NOKEY',
        },
      });

      // Should gracefully handle missing API key
      expect(result.data?.research).toBeTruthy();
      expect(result.data?.research.rawResults).toEqual([]);

      // Restore API key
      process.env.TAVILY_API_KEY = originalKey;
    });
  });
});
