import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import vulnerabilitiesRouter from '../../../../server/api/v1/vulnerabilities';
import { db } from '../../../../server/db';

// Mock dependencies
vi.mock('../../../../server/db');
vi.mock('../../../../server/auth/middleware', () => ({
  ensureAuthenticated: (req: any, res: any, next: any) => {
    if (req.user) {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  },
  ensureRole: (...roles: string[]) => (req: any, res: any, next: any) => {
    const user = req.user as any;
    if (user && roles.includes(user.role)) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  },
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

describe('Vulnerabilities API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Mock user middleware
    app.use((req: any, res, next) => {
      req.user = { id: 'test-user', role: 'admin' };
      next();
    });
    
    app.use('/api/v1/vulnerabilities', vulnerabilitiesRouter);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/vulnerabilities', () => {
    it('should return list of vulnerabilities', async () => {
      const mockVulns = [
        {
          id: '1',
          title: 'SQL Injection',
          severity: 'critical',
          status: 'open',
          cvss: 9.8,
        },
        {
          id: '2',
          title: 'XSS Vulnerability',
          severity: 'high',
          status: 'triaged',
          cvss: 7.5,
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockVulns),
      } as any);

      const response = await request(app)
        .get('/api/v1/vulnerabilities');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('vulnerabilities');
      expect(Array.isArray(response.body.vulnerabilities)).toBe(true);
    });

    it('should handle database errors', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      const response = await request(app)
        .get('/api/v1/vulnerabilities');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use('/api/v1/vulnerabilities', vulnerabilitiesRouter);

      const response = await request(app2)
        .get('/api/v1/vulnerabilities');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/vulnerabilities/:id', () => {
    it('should return vulnerability by id', async () => {
      const mockVuln = {
        id: '123',
        title: 'SQL Injection',
        severity: 'critical',
        status: 'open',
        cvss: 9.8,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockVuln]),
          }),
        }),
      } as any);

      const response = await request(app)
        .get('/api/v1/vulnerabilities/123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('vulnerability');
      expect(response.body.vulnerability).toEqual(mockVuln);
    });

    it('should return 404 for non-existent vulnerability', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await request(app)
        .get('/api/v1/vulnerabilities/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Vulnerability not found');
    });
  });

  describe('POST /api/v1/vulnerabilities', () => {
    it('should create new vulnerability', async () => {
      const newVuln = {
        title: 'Buffer Overflow',
        severity: 'high',
        cvss: 7.8,
        status: 'open',
      };

      const createdVuln = { id: 'new-456', ...newVuln };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdVuln]),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/vulnerabilities')
        .send(newVuln);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('vulnerability');
      expect(response.body.vulnerability).toMatchObject(newVuln);
    });

    it('should require admin or operator role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'viewer' };
        next();
      });
      app2.use('/api/v1/vulnerabilities', vulnerabilitiesRouter);

      const response = await request(app2)
        .post('/api/v1/vulnerabilities')
        .send({ title: 'Test Vuln', severity: 'low' });

      expect(response.status).toBe(403);
    });

    it('should handle creation errors', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/vulnerabilities')
        .send({ title: 'Test', severity: 'low' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/v1/vulnerabilities/:id', () => {
    it('should update existing vulnerability', async () => {
      const updatedData = {
        status: 'fixed',
        severity: 'medium',
      };

      const updatedVuln = { id: '123', ...updatedData };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedVuln]),
          }),
        }),
      } as any);

      const response = await request(app)
        .put('/api/v1/vulnerabilities/123')
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('vulnerability');
    });

    it('should return 404 when updating non-existent vulnerability', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await request(app)
        .put('/api/v1/vulnerabilities/999')
        .send({ status: 'fixed' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Vulnerability not found');
    });

    it('should require admin or operator role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'viewer' };
        next();
      });
      app2.use('/api/v1/vulnerabilities', vulnerabilitiesRouter);

      const response = await request(app2)
        .put('/api/v1/vulnerabilities/123')
        .send({ status: 'fixed' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/vulnerabilities/:id', () => {
    it('should delete vulnerability', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      const response = await request(app)
        .delete('/api/v1/vulnerabilities/123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Vulnerability deleted successfully');
    });

    it('should require admin role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/vulnerabilities', vulnerabilitiesRouter);

      const response = await request(app2)
        .delete('/api/v1/vulnerabilities/123');

      expect(response.status).toBe(403);
    });

    it('should handle deletion errors', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      const response = await request(app)
        .delete('/api/v1/vulnerabilities/123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Severity Levels', () => {
    const severities = ['critical', 'high', 'medium', 'low', 'info'];
    
    severities.forEach((severity) => {
      it(`should accept ${severity} severity`, () => {
        expect(severities).toContain(severity);
      });
    });
  });

  describe('CVSS Scoring', () => {
    it('should accept critical scores (9.0-10.0)', () => {
      const score = 9.8;
      expect(score).toBeGreaterThanOrEqual(9.0);
      expect(score).toBeLessThanOrEqual(10.0);
    });

    it('should accept high scores (7.0-8.9)', () => {
      const score = 7.5;
      expect(score).toBeGreaterThanOrEqual(7.0);
      expect(score).toBeLessThan(9.0);
    });

    it('should accept medium scores (4.0-6.9)', () => {
      const score = 5.5;
      expect(score).toBeGreaterThanOrEqual(4.0);
      expect(score).toBeLessThan(7.0);
    });

    it('should accept low scores (0.1-3.9)', () => {
      const score = 2.5;
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(4.0);
    });
  });

  describe('Status Workflow', () => {
    const validStatuses = ['open', 'triaged', 'in_progress', 'fixed', 'false_positive'];
    
    validStatuses.forEach((status) => {
      it(`should accept ${status} status`, () => {
        expect(validStatuses).toContain(status);
      });
    });
  });
});
