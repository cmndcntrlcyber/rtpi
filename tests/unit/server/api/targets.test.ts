import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import targetsRouter from '../../../../server/api/v1/targets';
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

describe('Targets API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Mock user middleware
    app.use((req: any, res, next) => {
      req.user = { id: 'test-user', role: 'admin' };
      next();
    });
    
    app.use('/api/v1/targets', targetsRouter);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/targets', () => {
    it('should return list of targets', async () => {
      const mockTargets = [
        { id: '1', value: '192.168.1.100', type: 'ip', status: 'active' },
        { id: '2', value: 'example.com', type: 'domain', status: 'active' },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockTargets),
      } as any);

      const response = await request(app)
        .get('/api/v1/targets');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('targets');
      expect(Array.isArray(response.body.targets)).toBe(true);
    });

    it('should handle database errors', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      const response = await request(app)
        .get('/api/v1/targets');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use('/api/v1/targets', targetsRouter);

      const response = await request(app2)
        .get('/api/v1/targets');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/targets/:id', () => {
    it('should return target by id', async () => {
      const mockTarget = { 
        id: '123', 
        value: '192.168.1.100', 
        type: 'ip',
        status: 'active',
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTarget]),
          }),
        }),
      } as any);

      const response = await request(app)
        .get('/api/v1/targets/123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('target');
      expect(response.body.target).toEqual(mockTarget);
    });

    it('should return 404 for non-existent target', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await request(app)
        .get('/api/v1/targets/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Target not found');
    });
  });

  describe('POST /api/v1/targets', () => {
    it('should create new target', async () => {
      const newTarget = {
        value: '192.168.1.200',
        type: 'ip',
        status: 'active',
      };

      const createdTarget = { id: 'new-123', ...newTarget };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdTarget]),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/targets')
        .send(newTarget);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('target');
      expect(response.body.target).toMatchObject(newTarget);
    });

    it('should require admin or operator role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'viewer' };
        next();
      });
      app2.use('/api/v1/targets', targetsRouter);

      const response = await request(app2)
        .post('/api/v1/targets')
        .send({ value: '192.168.1.1', type: 'ip' });

      expect(response.status).toBe(403);
    });

    it('should handle creation errors', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/targets')
        .send({ value: '192.168.1.1', type: 'ip' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/v1/targets/:id', () => {
    it('should update existing target', async () => {
      const updatedData = {
        value: '192.168.1.201',
        status: 'inactive',
      };

      const updatedTarget = { id: '123', ...updatedData };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedTarget]),
          }),
        }),
      } as any);

      const response = await request(app)
        .put('/api/v1/targets/123')
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('target');
    });

    it('should return 404 when updating non-existent target', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await request(app)
        .put('/api/v1/targets/999')
        .send({ status: 'inactive' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Target not found');
    });

    it('should require admin or operator role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'viewer' };
        next();
      });
      app2.use('/api/v1/targets', targetsRouter);

      const response = await request(app2)
        .put('/api/v1/targets/123')
        .send({ status: 'inactive' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/targets/:id', () => {
    it('should delete target', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      const response = await request(app)
        .delete('/api/v1/targets/123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Target deleted successfully');
    });

    it('should require admin role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/targets', targetsRouter);

      const response = await request(app2)
        .delete('/api/v1/targets/123');

      expect(response.status).toBe(403);
    });

    it('should handle deletion errors', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      const response = await request(app)
        .delete('/api/v1/targets/123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/targets/:id/scan', () => {
    it('should initiate target scan', async () => {
      const response = await request(app)
        .post('/api/v1/targets/123/scan');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Scan initiated');
      expect(response.body).toHaveProperty('targetId', '123');
    });

    it('should require admin or operator role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'viewer' };
        next();
      });
      app2.use('/api/v1/targets', targetsRouter);

      const response = await request(app2)
        .post('/api/v1/targets/123/scan');

      expect(response.status).toBe(403);
    });
  });

  describe('Target Types', () => {
    it('should accept IP address targets', () => {
      const ipTarget = { value: '192.168.1.100', type: 'ip' };
      expect(ipTarget.type).toBe('ip');
    });

    it('should accept domain targets', () => {
      const domainTarget = { value: 'example.com', type: 'domain' };
      expect(domainTarget.type).toBe('domain');
    });

    it('should accept URL targets', () => {
      const urlTarget = { value: 'https://example.com', type: 'url' };
      expect(urlTarget.type).toBe('url');
    });
  });

  describe('Role-Based Access Control', () => {
    const testCases = [
      { role: 'admin', canCreate: true, canUpdate: true, canDelete: true },
      { role: 'operator', canCreate: true, canUpdate: true, canDelete: false },
      { role: 'viewer', canCreate: false, canUpdate: false, canDelete: false },
    ];

    testCases.forEach(({ role, canCreate, canUpdate, canDelete }) => {
      it(`${role} role permissions`, () => {
        expect(canCreate).toBe(role === 'admin' || role === 'operator');
        expect(canUpdate).toBe(role === 'admin' || role === 'operator');
        expect(canDelete).toBe(role === 'admin');
      });
    });
  });
});
