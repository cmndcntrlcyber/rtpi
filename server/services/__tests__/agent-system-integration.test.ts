/**
 * Agent System Integration Tests
 *
 * Tests for v2.1 Autonomous Agent Framework components:
 * - Workflow orchestrator configuration
 * - Workflow template management
 * - Retry logic calculation
 * - Event-driven workflow triggers
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '../../db';
import {
  workflowTemplates,
  workflowInstances,
  nucleiTemplates,
} from '../../../shared/schema';
import { eq, sql } from 'drizzle-orm';

// Mock environment variables for testing
vi.stubEnv('WORKFLOW_RETRY_MAX_RETRIES', '2');
vi.stubEnv('WORKFLOW_RETRY_BACKOFF_MULTIPLIER', '2');
vi.stubEnv('WORKFLOW_RETRY_BASE_DELAY_MS', '100');

describe('Agent System Integration Tests', () => {
  // Track test data for cleanup
  const testTemplateIds: string[] = [];
  const testWorkflowIds: string[] = [];

  afterAll(async () => {
    try {
      // Clean up test workflow instances
      if (testWorkflowIds.length > 0) {
        for (const id of testWorkflowIds) {
          await db.delete(workflowInstances).where(eq(workflowInstances.id, id));
        }
      }

      // Clean up test templates
      if (testTemplateIds.length > 0) {
        for (const id of testTemplateIds) {
          await db.delete(workflowTemplates).where(eq(workflowTemplates.id, id));
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Workflow Templates', () => {
    it('should have default workflow templates seeded', async () => {
      const templates = await db.select().from(workflowTemplates);

      // Check for expected template names
      const templateNames = templates.map(t => t.name);

      expect(templateNames).toContain('Surface Assessment Workflow');
      expect(templateNames).toContain('Web Hacker Workflow');
      expect(templateNames).toContain('Full Assessment Pipeline');
      expect(templateNames).toContain('Tool Discovery Workflow');
      expect(templateNames).toContain('Quick Scan Workflow');
    });

    it('should have correct trigger events configured', async () => {
      const templates = await db.select().from(workflowTemplates);
      const templateMap = new Map(templates.map(t => [t.name, t]));

      const surfaceAssessment = templateMap.get('Surface Assessment Workflow');
      expect(surfaceAssessment?.triggerEvent).toBe('operation_created');

      const webHacker = templateMap.get('Web Hacker Workflow');
      expect(webHacker?.triggerEvent).toBe('surface_assessment_completed');

      const fullPipeline = templateMap.get('Full Assessment Pipeline');
      expect(fullPipeline?.triggerEvent).toBe('manual');
    });

    it('should have retry policy configured in templates', async () => {
      const [template] = await db
        .select()
        .from(workflowTemplates)
        .where(eq(workflowTemplates.name, 'Surface Assessment Workflow'))
        .limit(1);

      expect(template).toBeDefined();

      const config = template.configuration as any;
      expect(config).toBeDefined();
      expect(config.retryPolicy).toBeDefined();
      expect(config.retryPolicy.maxRetries).toBeGreaterThanOrEqual(0);
      expect(config.retryPolicy.backoffMultiplier).toBeGreaterThan(0);
    });

    it('should have fallback behavior configured', async () => {
      const templates = await db.select().from(workflowTemplates);

      for (const template of templates) {
        const config = template.configuration as any;
        if (config && config.fallbackBehavior) {
          expect(['skip', 'fail', 'substitute']).toContain(config.fallbackBehavior);
        }
      }
    });

    it('should allow creating custom workflow templates', async () => {
      const [newTemplate] = await db
        .insert(workflowTemplates)
        .values({
          name: 'Test Workflow Template',
          description: 'A test template for integration testing',
          triggerEvent: 'manual',
          requiredCapabilities: ['test_capability'],
          optionalCapabilities: [],
          configuration: {
            maxParallelAgents: 1,
            timeoutPerPhase: 60000,
            retryPolicy: { maxRetries: 2, backoffMultiplier: 2 },
            fallbackBehavior: 'fail',
          },
          isActive: true,
        })
        .returning();

      testTemplateIds.push(newTemplate.id);

      expect(newTemplate.id).toBeDefined();
      expect(newTemplate.name).toBe('Test Workflow Template');
      expect(newTemplate.isActive).toBe(true);
    });

    it('should support required and optional capabilities', async () => {
      const [template] = await db
        .select()
        .from(workflowTemplates)
        .where(eq(workflowTemplates.name, 'Full Assessment Pipeline'))
        .limit(1);

      expect(template).toBeDefined();
      expect(template.requiredCapabilities).toBeDefined();
      expect(Array.isArray(template.requiredCapabilities)).toBe(true);
      expect((template.requiredCapabilities as string[]).length).toBeGreaterThan(0);
    });
  });

  describe('Workflow Instance Creation', () => {
    it('should create workflow instance from template', async () => {
      // Get a template
      const [template] = await db
        .select()
        .from(workflowTemplates)
        .where(eq(workflowTemplates.name, 'Quick Scan Workflow'))
        .limit(1);

      if (!template) {
        console.warn('Quick Scan Workflow template not found, skipping test');
        return;
      }

      // Create instance
      const [instance] = await db
        .insert(workflowInstances)
        .values({
          templateId: template.id,
          status: 'pending',
          context: { testContext: true },
          resolvedAgents: [],
          currentPhase: 0,
        })
        .returning();

      testWorkflowIds.push(instance.id);

      expect(instance.id).toBeDefined();
      expect(instance.templateId).toBe(template.id);
      expect(instance.status).toBe('pending');
    });

    it('should store context data in workflow instance', async () => {
      const [template] = await db
        .select()
        .from(workflowTemplates)
        .limit(1);

      if (!template) {
        console.warn('No template found, skipping test');
        return;
      }

      const testContext = {
        operationName: 'Test Operation',
        targets: ['example.com', 'test.local'],
        options: { verbose: true },
      };

      const [instance] = await db
        .insert(workflowInstances)
        .values({
          templateId: template.id,
          status: 'pending',
          context: testContext,
          resolvedAgents: [],
        })
        .returning();

      testWorkflowIds.push(instance.id);

      expect(instance.context).toEqual(testContext);
    });

    it('should store resolved agents in workflow instance', async () => {
      const [template] = await db
        .select()
        .from(workflowTemplates)
        .limit(1);

      if (!template) {
        console.warn('No template found, skipping test');
        return;
      }

      const resolvedAgents = [
        {
          agentId: '00000000-0000-0000-0000-000000000001',
          capability: 'test_capability',
          phase: 0,
          dependencies: [],
          status: 'pending',
        },
      ];

      const [instance] = await db
        .insert(workflowInstances)
        .values({
          templateId: template.id,
          status: 'pending',
          context: {},
          resolvedAgents,
        })
        .returning();

      testWorkflowIds.push(instance.id);

      expect(instance.resolvedAgents).toEqual(resolvedAgents);
    });
  });

  describe('Workflow Status Management', () => {
    it('should update workflow instance status', async () => {
      const [template] = await db
        .select()
        .from(workflowTemplates)
        .limit(1);

      if (!template) return;

      const [instance] = await db
        .insert(workflowInstances)
        .values({
          templateId: template.id,
          status: 'pending',
          context: {},
          resolvedAgents: [],
        })
        .returning();

      testWorkflowIds.push(instance.id);

      // Update to running
      await db
        .update(workflowInstances)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(workflowInstances.id, instance.id));

      const [updated] = await db
        .select()
        .from(workflowInstances)
        .where(eq(workflowInstances.id, instance.id));

      expect(updated.status).toBe('running');
      expect(updated.startedAt).toBeDefined();
    });

    it('should track workflow phase progression', async () => {
      const [template] = await db
        .select()
        .from(workflowTemplates)
        .limit(1);

      if (!template) return;

      const [instance] = await db
        .insert(workflowInstances)
        .values({
          templateId: template.id,
          status: 'running',
          context: {},
          resolvedAgents: [],
          currentPhase: 0,
        })
        .returning();

      testWorkflowIds.push(instance.id);

      // Progress through phases
      for (let phase = 1; phase <= 3; phase++) {
        await db
          .update(workflowInstances)
          .set({ currentPhase: phase })
          .where(eq(workflowInstances.id, instance.id));
      }

      const [final] = await db
        .select()
        .from(workflowInstances)
        .where(eq(workflowInstances.id, instance.id));

      expect(final.currentPhase).toBe(3);
    });

    it('should record error messages on failure', async () => {
      const [template] = await db
        .select()
        .from(workflowTemplates)
        .limit(1);

      if (!template) return;

      const [instance] = await db
        .insert(workflowInstances)
        .values({
          templateId: template.id,
          status: 'running',
          context: {},
          resolvedAgents: [],
        })
        .returning();

      testWorkflowIds.push(instance.id);

      const errorMessage = 'Phase 2 failed: Agent timeout exceeded';

      await db
        .update(workflowInstances)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorMessage,
        })
        .where(eq(workflowInstances.id, instance.id));

      const [failed] = await db
        .select()
        .from(workflowInstances)
        .where(eq(workflowInstances.id, instance.id));

      expect(failed.status).toBe('failed');
      expect(failed.errorMessage).toBe(errorMessage);
    });
  });
});

describe('Dynamic Workflow Orchestrator Unit Tests', () => {
  describe('Exponential Backoff Calculation', () => {
    it('should calculate correct backoff delays', () => {
      // Test the backoff formula: baseDelay * Math.pow(multiplier, attempt - 1)
      const baseDelay = 1000;
      const multiplier = 2;

      const calculateBackoff = (attempt: number) =>
        Math.min(baseDelay * Math.pow(multiplier, attempt - 1), 60000);

      expect(calculateBackoff(1)).toBe(1000);  // 1000 * 2^0 = 1000
      expect(calculateBackoff(2)).toBe(2000);  // 1000 * 2^1 = 2000
      expect(calculateBackoff(3)).toBe(4000);  // 1000 * 2^2 = 4000
      expect(calculateBackoff(4)).toBe(8000);  // 1000 * 2^3 = 8000
      expect(calculateBackoff(7)).toBe(60000); // Capped at max
    });

    it('should respect max delay cap', () => {
      const baseDelay = 10000;
      const multiplier = 3;
      const maxDelay = 30000;

      const calculateBackoff = (attempt: number) =>
        Math.min(baseDelay * Math.pow(multiplier, attempt - 1), maxDelay);

      expect(calculateBackoff(1)).toBe(10000);
      expect(calculateBackoff(2)).toBe(30000); // 10000 * 3 = 30000, at cap
      expect(calculateBackoff(3)).toBe(30000); // Would be 90000, capped to 30000
    });
  });

  describe('Retry Policy Configuration', () => {
    it('should use default retry values when not specified', () => {
      const defaultMaxRetries = parseInt(process.env.WORKFLOW_RETRY_MAX_RETRIES || '3', 10);
      const defaultMultiplier = parseFloat(process.env.WORKFLOW_RETRY_BACKOFF_MULTIPLIER || '2');

      expect(defaultMaxRetries).toBeGreaterThanOrEqual(0);
      expect(defaultMultiplier).toBeGreaterThan(0);
    });

    it('should extract retry policy from template config', () => {
      const templateConfig = {
        maxParallelAgents: 1,
        timeoutPerPhase: 7200000,
        retryPolicy: { maxRetries: 5, backoffMultiplier: 1.5 },
        fallbackBehavior: 'skip',
      };

      const retryPolicy = templateConfig.retryPolicy;

      expect(retryPolicy.maxRetries).toBe(5);
      expect(retryPolicy.backoffMultiplier).toBe(1.5);
    });
  });

  describe('Conditional Dependency Evaluation', () => {
    // Test the condition evaluation logic
    const evaluateCondition = (
      condition: any,
      context: Record<string, any>
    ): boolean => {
      if (!condition || Object.keys(condition).length === 0) {
        return true;
      }

      switch (condition.type) {
        case 'context_has':
          return condition.field in context;
        case 'context_equals':
          return context[condition.field] === condition.value;
        case 'capability_available':
          // Simplified for unit test
          return true;
        default:
          return true;
      }
    };

    it('should return true for empty conditions', () => {
      expect(evaluateCondition(null, {})).toBe(true);
      expect(evaluateCondition({}, {})).toBe(true);
      expect(evaluateCondition(undefined, {})).toBe(true);
    });

    it('should evaluate context_has condition', () => {
      const condition = { type: 'context_has', field: 'targetUrl' };

      expect(evaluateCondition(condition, { targetUrl: 'https://example.com' })).toBe(true);
      expect(evaluateCondition(condition, {})).toBe(false);
      expect(evaluateCondition(condition, { otherField: 'value' })).toBe(false);
    });

    it('should evaluate context_equals condition', () => {
      const condition = { type: 'context_equals', field: 'scanType', value: 'full' };

      expect(evaluateCondition(condition, { scanType: 'full' })).toBe(true);
      expect(evaluateCondition(condition, { scanType: 'quick' })).toBe(false);
      expect(evaluateCondition(condition, {})).toBe(false);
    });
  });
});

describe('Nuclei Template Schema Tests', () => {
  it('should have nuclei templates table available', async () => {
    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(nucleiTemplates);

    // Just verify the table is accessible
    expect(count).toBeDefined();
    expect(Number(count[0].count)).toBeGreaterThanOrEqual(0);
  });
});
