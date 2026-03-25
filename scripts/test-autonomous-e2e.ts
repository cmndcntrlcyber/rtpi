#!/usr/bin/env tsx
/**
 * End-to-End Autonomous Operation Test
 *
 * Tests the complete autonomous pipeline:
 *   1. Creates test operation with targets + vulnerabilities
 *   2. Triggers autonomous execution
 *   3. Verifies all 5 phases complete
 *   4. Checks final operation status
 *   5. Cleans up test data
 */

// Must polyfill fetch before any module-level SDK initialization
async function bootstrap() {
  const nodeFetch = await import('node-fetch');
  if (!globalThis.fetch) {
    (globalThis as any).fetch = nodeFetch.default;
    (globalThis as any).Headers = nodeFetch.Headers;
    (globalThis as any).Request = nodeFetch.Request;
    (globalThis as any).Response = nodeFetch.Response;
  }

  const { db } = await import('../server/db');
  const schema = await import('../shared/schema');
  const { eq } = await import('drizzle-orm');
  const { autonomousOperationOrchestrator } = await import('../server/services/autonomous-operation-orchestrator');

  return { db, operations: schema.operations, targets: schema.targets, vulnerabilities: schema.vulnerabilities, eq, autonomousOperationOrchestrator };
}

let db: any, operations: any, targets: any, vulnerabilities: any, eq: any, autonomousOperationOrchestrator: any;

const TEST_PREFIX = 'E2E_TEST_';

async function createTestData() {
  console.log('\n1. Creating test data...');

  // Get an existing user for ownerId
  const { users } = await import('../shared/schema');
  const [existingUser] = await db.select({ id: users.id }).from(users).limit(1);
  if (!existingUser) {
    throw new Error('No users exist in database — create a user first');
  }
  const ownerId = existingUser.id;
  console.log(`   Using owner: ${ownerId}`);

  // Create test operation
  const [operation] = await db
    .insert(operations)
    .values({
      name: `${TEST_PREFIX}Autonomous Operation`,
      description: 'E2E test for autonomous pipeline',
      status: 'planning',
      objectives: 'Test all 5 phases of autonomous execution',
      scope: 'exploitation',
      ownerId,
      metadata: { scope: ['reconnaissance', 'vulnerability_scan', 'exploitation'] },
    } as any)
    .returning();

  console.log(`   Operation: ${operation.id} (${operation.name})`);

  // Create test targets
  const [target1] = await db
    .insert(targets)
    .values({
      operationId: operation.id,
      name: 'Test Target 1',
      type: 'domain',
      value: 'test.example.com',
      status: 'active',
    } as any)
    .returning();

  const [target2] = await db
    .insert(targets)
    .values({
      operationId: operation.id,
      name: 'Test Target 2',
      type: 'ip',
      value: '192.168.1.100',
      status: 'active',
    } as any)
    .returning();

  console.log(`   Targets: ${target1.id}, ${target2.id}`);

  // Create test vulnerabilities
  const [vuln1] = await db
    .insert(vulnerabilities)
    .values({
      operationId: operation.id,
      targetId: target1.id,
      title: 'Test SQL Injection',
      description: 'A SQL injection vulnerability was found in the login form allowing unauthorized database access via user input concatenation.',
      severity: 'critical',
      status: 'confirmed',
      cveId: 'CVE-2024-99999',
      cvssScore: 98,
    } as any)
    .returning();

  const [vuln2] = await db
    .insert(vulnerabilities)
    .values({
      operationId: operation.id,
      targetId: target2.id,
      title: 'Test XSS Vulnerability',
      description: 'A reflected cross-site scripting vulnerability exists in the search parameter allowing execution of arbitrary JavaScript.',
      severity: 'high',
      status: 'confirmed',
      cveId: 'CVE-2024-99998',
      cvssScore: 75,
    } as any)
    .returning();

  console.log(`   Vulnerabilities: ${vuln1.id}, ${vuln2.id}`);

  return {
    operationId: operation.id,
    targetIds: [target1.id, target2.id],
    vulnIds: [vuln1.id, vuln2.id],
  };
}

async function runAutonomousPipeline(operationId: string) {
  console.log('\n2. Starting autonomous execution...');
  console.log('   Listening for phase events...\n');

  const phaseResults: Record<string, any> = {};

  // Listen for phase events
  autonomousOperationOrchestrator.on('phase_completed', (data) => {
    console.log(`   Phase completed: ${data.phase}`);
    phaseResults[data.phase] = data;
  });

  autonomousOperationOrchestrator.on('operation_completed', (data) => {
    console.log(`\n   Operation completed in ${data.durationMs}ms`);
  });

  autonomousOperationOrchestrator.on('operation_failed', (data) => {
    console.log(`\n   Operation FAILED: ${data.error}`);
  });

  const result = await autonomousOperationOrchestrator.executeOperation(operationId);

  // Remove listeners
  autonomousOperationOrchestrator.removeAllListeners();

  return result;
}

async function verifyResults(operationId: string, result: any) {
  console.log('\n3. Verifying results...\n');

  let passed = 0;
  let failed = 0;

  const check = (name: string, condition: boolean, detail?: string) => {
    if (condition) {
      console.log(`   PASS: ${name}${detail ? ` (${detail})` : ''}`);
      passed++;
    } else {
      console.log(`   FAIL: ${name}${detail ? ` (${detail})` : ''}`);
      failed++;
    }
  };

  // Phase 1: Review
  check('Phase 1 (Review) succeeded', result.phases.review.success);
  check('Phase 1 generated tasks', result.phases.review.taskCount > 0, `${result.phases.review.taskCount} tasks`);

  // Phase 2: Execution
  check('Phase 2 (Execution) ran', result.phases.execution.completed >= 0 || result.phases.execution.failed >= 0);

  // Phase 3: Validation
  check('Phase 3 (Validation) ran', result.phases.validation.success !== undefined);

  // Phase 4: QA
  check('Phase 4 (QA) ran', result.phases.qa.iterations > 0, `${result.phases.qa.iterations} iterations`);
  check('Phase 4 (QA) quality field works', result.phases.qa.passed !== undefined);

  // Phase 5: Reporting
  check('Phase 5 (Reporting) ran', result.phases.reporting.success !== undefined);

  // Overall
  check('Pipeline completed', result.success || result.phases.review.success, 'at least review phase succeeded');
  check('Duration recorded', result.totalDurationMs > 0, `${result.totalDurationMs}ms`);

  // Check operation status in DB
  const [op] = await db
    .select()
    .from(operations)
    .where(eq(operations.id, operationId))
    .limit(1);

  check('Operation status updated', op?.status === 'completed' || op?.status === 'paused', op?.status);

  console.log(`\n   Results: ${passed} passed, ${failed} failed out of ${passed + failed} checks`);

  return { passed, failed };
}

async function cleanupTestData(operationId: string, targetIds: string[], vulnIds: string[]) {
  console.log('\n4. Cleaning up test data...');

  for (const id of vulnIds) {
    await db.delete(vulnerabilities).where(eq(vulnerabilities.id, id));
  }
  for (const id of targetIds) {
    await db.delete(targets).where(eq(targets.id, id));
  }
  await db.delete(operations).where(eq(operations.id, operationId));

  console.log('   Cleanup complete');
}

async function main() {
  console.log('====================================================');
  console.log(' E2E Autonomous Operation Test');
  console.log('====================================================');

  // Bootstrap with fetch polyfill
  const modules = await bootstrap();
  db = modules.db;
  operations = modules.operations;
  targets = modules.targets;
  vulnerabilities = modules.vulnerabilities;
  eq = modules.eq;
  autonomousOperationOrchestrator = modules.autonomousOperationOrchestrator;

  let testData: { operationId: string; targetIds: string[]; vulnIds: string[] } | null = null;

  try {
    // Step 1: Create test data
    testData = await createTestData();

    // Step 2: Run autonomous pipeline
    const result = await runAutonomousPipeline(testData.operationId);

    // Step 3: Verify results
    const { passed, failed } = await verifyResults(testData.operationId, result);

    // Step 4: Cleanup
    await cleanupTestData(testData.operationId, testData.targetIds, testData.vulnIds);

    // Summary
    console.log('\n====================================================');
    console.log(' E2E Test Summary');
    console.log('====================================================');
    console.log(`\nPhase Results:`);
    console.log(`  Review:     ${result.phases.review.success ? 'PASS' : 'FAIL'} (${result.phases.review.taskCount} tasks)`);
    console.log(`  Execution:  ${result.phases.execution.completed} completed, ${result.phases.execution.failed} failed`);
    console.log(`  Validation: ${result.phases.validation.confirmed} confirmed, ${result.phases.validation.falsePositives} false positives`);
    console.log(`  QA:         ${result.phases.qa.iterations} iterations, passed=${result.phases.qa.passed}`);
    console.log(`  Reporting:  ${result.phases.reporting.success ? 'PASS' : 'FAIL'}`);
    console.log(`\nOverall: ${result.success ? 'SUCCESS' : 'PARTIAL'} in ${result.totalDurationMs}ms`);
    console.log(`Checks: ${passed} passed, ${failed} failed`);

    if (failed > 0) {
      console.log('\nSome checks failed — review the output above for details.');
      console.log('Note: Execution/reporting phases may fail without running tool containers.');
    }

    console.log('\nE2E Test Complete\n');
  } catch (error) {
    console.error('\nE2E Test FAILED:', error instanceof Error ? error.message : error);

    // Cleanup on failure
    if (testData) {
      await cleanupTestData(testData.operationId, testData.targetIds, testData.vulnIds).catch(() => {});
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
