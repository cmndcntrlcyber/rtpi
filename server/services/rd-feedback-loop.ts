/**
 * R&D Feedback Loop
 *
 * Listens for tool test results and automatically creates refinement
 * experiments when R&D-generated tools fail testing. This closes the
 * loop between tool promotion and iterative improvement.
 */

import { toolTestEvents } from './tool-tester';
import { db } from '../db';
import { toolRegistry, rdArtifacts, rdExperiments } from '@shared/schema';
import { eq } from 'drizzle-orm';

toolTestEvents.on('test_complete', async ({ toolId, allPassed, results }) => {
  if (allPassed) return; // No feedback needed for passing tools

  try {
    // Check if this is an R&D-generated tool
    const [tool] = await db
      .select({ id: toolRegistry.id, name: toolRegistry.name, rdArtifactId: toolRegistry.rdArtifactId })
      .from(toolRegistry)
      .where(eq(toolRegistry.id, toolId))
      .limit(1);

    if (!tool?.rdArtifactId) return; // Not an R&D tool, skip

    // Look up the original artifact for project/experiment context
    const [artifact] = await db
      .select({ experimentId: rdArtifacts.experimentId, projectId: rdArtifacts.projectId })
      .from(rdArtifacts)
      .where(eq(rdArtifacts.id, tool.rdArtifactId))
      .limit(1);

    if (!artifact) return;

    // Summarize failures
    const failures = results
      .filter((r: any) => !r.passed)
      .map((r: any) => `${r.testType}: ${r.message}`)
      .join('; ');

    // Create a refinement experiment
    await db.insert(rdExperiments).values({
      projectId: artifact.projectId,
      name: `Refinement: ${tool.name} test failures`,
      description: `Auto-generated refinement for R&D tool "${tool.name}" that failed testing.`,
      methodology: `Fix failing tests: ${failures}`,
      status: 'planned',
      toolsUsed: [],
      targets: [],
      results: {},
    });

    console.log(`[RD Feedback] Created refinement experiment for tool "${tool.name}"`);
  } catch (error) {
    console.error('[RD Feedback] Error creating refinement experiment:', error);
  }
});
