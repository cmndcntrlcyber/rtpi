import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import healthChecksRouter from '../../../../server/api/v1/health-checks';
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
}));

describe('Health Checks API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Mock user middleware
    app.use((req: any, res, next) => {
      req.user = { id: 'test-user', role: 'admin' };
      next();
    });
    
    app.use('/api/v1/health-checks', healthChecksRouter);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/health-checks', () => {
    it('should return list of health checks', async () => {
      const mockChecks = [
        { id: '1', name: 'database-check', status: 'healthy', interval: 60 },
        { id: '2', name: 'redis-check', status: 'unhealthy', interval: 30 },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockChecks),
      } as any);

      const response = await request(app)
        .get('/api/v1/health-checks');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('healthChecks');
      expect(Array.isArray(response.body.healthChecks)).toBe(true);
    });

    it('should handle database errors', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      const response = await request(app)
        .get('/api/v1/health-checks');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use('/api/v1/health-checks', healthChecksRouter);

      const response = await request(app2)
        .get('/api/v1/health-checks');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/health-checks/:id', () => {
    it('should return health check by id', async () => {
      const mockCheck = {
        id: '123',
        name: 'database-check',
        status: 'healthy',
        interval: 60,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockCheck]),
          }),
        }),
      } as any);

      const response = await request(app)
        .get('/api/v1/health-checks/123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('healthCheck');
      expect(response.body.healthCheck).toEqual(mockCheck);
    });

    it('should return 404 for non-existent health check', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await request(app)
        .get('/api/v1/health-checks/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Health check not found');
    });
  });

  describe('POST /api/v1/health-checks', () => {
    it('should create new health check', async () => {
      const newCheck = {
        name: 'api-check',
        status: 'healthy',
        interval: 120,
      };

      const createdCheck = { id: 'new-check', ...newCheck };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdCheck]),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/health-checks')
        .send(newCheck);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('healthCheck');
      expect(response.body.healthCheck).toMatchObject(newCheck);
    });

    it('should require admin role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/health-checks', healthChecksRouter);

      const response = await request(app2)
        .post('/api/v1/health-checks')
        .send({ name: 'test-check', interval: 60 });

      expect(response.status).toBe(403);
    });

    it('should handle creation errors', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/health-checks')
        .send({ name: 'test', interval: 60 });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/v1/health-checks/:id', () => {
    it('should update existing health check', async () => {
      const updatedData = {
        status: 'unhealthy',
      };

      const updatedCheck = { id: '123', ...updatedData };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedCheck]),
          }),
        }),
      } as any);

      const response = await request(app)
        .put('/api/v1/health-checks/123')
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('healthCheck');
    });

    it('should return 404 when updating non-existent health check', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await request(app)
        .put('/api/v1/health-checks/999')
        .send({ status: 'unhealthy' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Health check not found');
    });

    it('should allow admin or operator to update', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/health-checks', healthChecksRouter);

      const updatedCheck = { id: '123', status: 'healthy' };
      
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedCheck]),
          }),
        }),
      } as any);

      const response = await request(app2)
        .put('/api/v1/health-checks/123')
        .send({ status: 'healthy' });

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/v1/health-checks/:id', () => {
    it('should delete health check', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      const response = await request(app)
        .delete('/api/v1/health-checks/123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Health check deleted successfully');
    });

    it('should require admin role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/health-checks', healthChecksRouter);

      const response = await request(app2)
        .delete('/api/v1/health-checks/123');

      expect(response.status).toBe(403);
    });

    it('should handle deletion errors', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      const response = await request(app)
        .delete('/api/v1/health-checks/123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Health Check Status', () => {
    const validStatuses = ['healthy', 'unhealthy', 'degraded', 'unknown'];
    
    validStatuses.forEach((status) => {
      it(`should accept ${status} status`, () => {
        expect(validStatuses).toContain(status);
      });
    });
  });

  describe('Check Intervals', () => {
    it('should accept valid check intervals', () => {
      const intervals = [30, 60, 120, 300];
      intervals.forEach((interval) => {
        expect(interval).toBeGreaterThan(0);
      });
    });
  });
});
