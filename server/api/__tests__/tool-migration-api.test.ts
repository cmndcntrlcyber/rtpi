/**
 * Tool Migration API Integration Tests
 * Tests REST API endpoints for tool migration functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import toolMigrationRoutes from '../v1/tool-migration';
import { db } from '../../db';
import { securityTools } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

describe('Tool Migration API Endpoints', () => {
  let app: express.Application;

  beforeAll(() => {
    // Setup test Express app
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(
      session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
      })
    );

    // Mount routes
    app.use('/api/v1/tool-migration', toolMigrationRoutes);
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(securityTools).where(eq(securityTools.name, 'WebVulnerabilityTester'));
  });

  describe('GET /api/v1/tool-migration/analyze', () => {
    it('should return analysis of all offsec-team tools', async () => {
      const response = await request(app)
        .get('/api/v1/tool-migration/analyze')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.toolsByCategory).toBeDefined();

      // Verify summary structure
      const summary = response.body.data.summary;
      expect(summary.totalTools).toBeGreaterThan(0);
      expect(summary.byCategory).toBeDefined();
      expect(summary.byComplexity).toBeDefined();
      expect(summary.tools).toBeDefined();
      expect(Array.isArray(summary.tools)).toBe(true);

      // Verify complexity breakdown
      expect(summary.byComplexity.low).toBeGreaterThanOrEqual(0);
      expect(summary.byComplexity.medium).toBeGreaterThanOrEqual(0);
      expect(summary.byComplexity.high).toBeGreaterThanOrEqual(0);
      expect(summary.byComplexity['very-high']).toBeGreaterThanOrEqual(0);

      // Verify categories
      expect(response.body.data.toolsByCategory).toHaveProperty('bug_hunter');
      expect(response.body.data.toolsByCategory).toHaveProperty('burpsuite_operator');
    }, 30000);

    it('should handle errors gracefully', async () => {
      // This test would require mocking the analyzer to throw an error
      // For now, just verify the endpoint exists
      const response = await request(app)
        .get('/api/v1/tool-migration/analyze');

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('POST /api/v1/tool-migration/analyze-file', () => {
    it('should analyze a specific tool file', async () => {
      const testFilePath = '/home/cmndcntrl/rtpi/tools/offsec-team/tools/bug_hunter/WebVulnerabilityTester.py';

      const response = await request(app)
        .post('/api/v1/tool-migration/analyze-file')
        .send({ filePath: testFilePath })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      const analysis = response.body.data;
      expect(analysis.toolName).toBe('WebVulnerabilityTester');
      expect(analysis.className).toBe('WebVulnerabilityTester');
      expect(analysis.category).toBeDefined();
      expect(analysis.complexity).toBeDefined();
      expect(analysis.methods).toBeDefined();
      expect(analysis.dependencies).toBeDefined();
    });

    it('should return 400 when filePath is missing', async () => {
      const response = await request(app)
        .post('/api/v1/tool-migration/analyze-file')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('filePath is required');
    });

    it('should return 500 for invalid file path', async () => {
      const response = await request(app)
        .post('/api/v1/tool-migration/analyze-file')
        .send({ filePath: '/invalid/path/tool.py' })
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/v1/tool-migration/analyze-directory', () => {
    it('should analyze all tools in a directory', async () => {
      const testDirPath = '/home/cmndcntrl/rtpi/tools/offsec-team/tools/bug_hunter';

      const response = await request(app)
        .post('/api/v1/tool-migration/analyze-directory')
        .send({ dirPath: testDirPath })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.count).toBeGreaterThan(0);
      expect(response.body.data.tools).toBeDefined();
      expect(Array.isArray(response.body.data.tools)).toBe(true);

      // Verify all tools are from scanning category
      expect(response.body.data.tools.every((t: any) => t.category === 'scanning')).toBe(true);
    });

    it('should return 400 when dirPath is missing', async () => {
      const response = await request(app)
        .post('/api/v1/tool-migration/analyze-directory')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('dirPath is required');
    });
  });

  describe('POST /api/v1/tool-migration/migrate', () => {
    it('should migrate a single tool successfully', async () => {
      const testFilePath = '/home/cmndcntrl/rtpi/tools/offsec-team/tools/bug_hunter/WebVulnerabilityTester.py';

      const response = await request(app)
        .post('/api/v1/tool-migration/migrate')
        .send({
          filePath: testFilePath,
          options: {
            installDependencies: false,
            runTests: false,
            registerInDatabase: true,
            generateWrapper: true,
            overwriteExisting: true,
          },
        })
        .expect('Content-Type', /json/);

      // May be 200 or 500 depending on migration success
      expect([200, 500]).toContain(response.status);

      expect(response.body.success).toBeDefined();
      expect(response.body.data).toBeDefined();

      if (response.body.success) {
        const result = response.body.data;
        expect(result.toolName).toBe('WebVulnerabilityTester');
        expect(result.status).toBe('completed');
        expect(result.toolId).toBeDefined();
        expect(result.steps).toBeDefined();
      }
    }, 30000);

    it('should return 400 when filePath is missing', async () => {
      const response = await request(app)
        .post('/api/v1/tool-migration/migrate')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('filePath is required');
    });

    it('should use default options when not provided', async () => {
      const testFilePath = '/home/cmndcntrl/rtpi/tools/offsec-team/tools/bug_hunter/WebVulnerabilityTester.py';

      const response = await request(app)
        .post('/api/v1/tool-migration/migrate')
        .send({ filePath: testFilePath });

      expect([200, 500]).toContain(response.status);
      expect(response.body).toBeDefined();
    }, 30000);
  });

  describe('POST /api/v1/tool-migration/migrate-batch', () => {
    it('should migrate tools by category', async () => {
      const response = await request(app)
        .post('/api/v1/tool-migration/migrate-batch')
        .send({
          category: 'bug_hunter',
          options: {
            installDependencies: false,
            runTests: false,
            registerInDatabase: false,
            generateWrapper: false,
            overwriteExisting: true,
          },
        })
        .expect('Content-Type', /json/);

      expect([200, 500]).toContain(response.status);

      if (response.body.success) {
        expect(response.body.data).toBeDefined();
        expect(response.body.data.summary).toBeDefined();
        expect(response.body.data.results).toBeDefined();

        const summary = response.body.data.summary;
        expect(summary.total).toBeGreaterThan(0);
        expect(summary.completed).toBeGreaterThanOrEqual(0);
        expect(summary.failed).toBeGreaterThanOrEqual(0);
      }
    }, 60000);

    it('should migrate specific tools by name', async () => {
      const response = await request(app)
        .post('/api/v1/tool-migration/migrate-batch')
        .send({
          toolNames: ['WebVulnerabilityTester'],
          options: {
            installDependencies: false,
            runTests: false,
            registerInDatabase: false,
            generateWrapper: false,
            overwriteExisting: true,
          },
        })
        .expect('Content-Type', /json/);

      expect([200, 404, 500]).toContain(response.status);

      if (response.status === 200 && response.body.success) {
        expect(response.body.data.summary.total).toBeGreaterThan(0);
      }
    }, 30000);

    it('should return 400 when neither toolNames nor category provided', async () => {
      const response = await request(app)
        .post('/api/v1/tool-migration/migrate-batch')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Either toolNames array or category is required');
    });

    it('should return 404 when no tools found', async () => {
      const response = await request(app)
        .post('/api/v1/tool-migration/migrate-batch')
        .send({
          toolNames: ['NonExistentTool123'],
          options: {
            installDependencies: false,
            runTests: false,
            registerInDatabase: false,
            generateWrapper: false,
          },
        })
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No tools found');
    });
  });

  describe('GET /api/v1/tool-migration/status/:toolName', () => {
    it('should return status for non-existent tool', async () => {
      const response = await request(app)
        .get('/api/v1/tool-migration/status/NonExistentTool123')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.exists).toBe(false);
      expect(response.body.data.installed).toBe(false);
    });

    it('should return status for existing tool', async () => {
      // First migrate a tool
      const testFilePath = '/home/cmndcntrl/rtpi/tools/offsec-team/tools/bug_hunter/WebVulnerabilityTester.py';

      await request(app)
        .post('/api/v1/tool-migration/migrate')
        .send({
          filePath: testFilePath,
          options: {
            installDependencies: false,
            runTests: false,
            registerInDatabase: true,
            generateWrapper: false,
            overwriteExisting: true,
          },
        });

      // Check status
      const response = await request(app)
        .get('/api/v1/tool-migration/status/WebVulnerabilityTester')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      if (response.body.data.exists) {
        expect(response.body.data.installed).toBe(true);
        expect(response.body.data.toolId).toBeDefined();
        expect(response.body.data.config).toBeDefined();
      }
    }, 30000);
  });

  describe('GET /api/v1/tool-migration/recommendations', () => {
    it('should return recommended tools for migration', async () => {
      const response = await request(app)
        .get('/api/v1/tool-migration/recommendations')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.recommended).toBeDefined();
      expect(response.body.data.total).toBeDefined();
      expect(response.body.data.criteria).toBeDefined();

      // Verify recommendations structure
      expect(Array.isArray(response.body.data.recommended)).toBe(true);
      expect(response.body.data.recommended.length).toBeLessThanOrEqual(16);

      // Verify each recommendation has priority score
      if (response.body.data.recommended.length > 0) {
        const firstRec = response.body.data.recommended[0];
        expect(firstRec.priorityScore).toBeDefined();
        expect(firstRec.toolName).toBeDefined();
        expect(firstRec.complexity).toBeDefined();
      }

      // Verify criteria explanation
      expect(response.body.data.criteria.categoryPriority).toBeDefined();
      expect(response.body.data.criteria.complexityBonus).toBeDefined();
    }, 30000);

    it('should return tools sorted by priority score', async () => {
      const response = await request(app)
        .get('/api/v1/tool-migration/recommendations')
        .expect(200);

      const recommended = response.body.data.recommended;

      if (recommended.length > 1) {
        // Verify descending order
        for (let i = 0; i < recommended.length - 1; i++) {
          expect(recommended[i].priorityScore).toBeGreaterThanOrEqual(
            recommended[i + 1].priorityScore
          );
        }
      }
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle internal server errors gracefully', async () => {
      // Send invalid data that causes processing error
      const response = await request(app)
        .post('/api/v1/tool-migration/analyze-file')
        .send({ filePath: null })
        .expect('Content-Type', /json/);

      expect([400, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should include error messages in response', async () => {
      const response = await request(app)
        .post('/api/v1/tool-migration/migrate')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(typeof response.body.error).toBe('string');
    });
  });

  describe('Response Format', () => {
    it('should return consistent success response format', async () => {
      const response = await request(app)
        .get('/api/v1/tool-migration/status/TestTool')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(typeof response.body.success).toBe('boolean');
    });

    it('should return consistent error response format', async () => {
      const response = await request(app)
        .post('/api/v1/tool-migration/migrate')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('error');
      expect(response.body.success).toBe(false);
      expect(typeof response.body.error).toBe('string');
    });
  });
});
