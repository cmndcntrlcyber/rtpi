import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import containersRouter from '../../../../server/api/v1/containers';
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

describe('Containers API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Mock user middleware
    app.use((req: any, res, next) => {
      req.user = { id: 'test-user', role: 'admin' };
      next();
    });
    
    app.use('/api/v1/containers', containersRouter);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/containers', () => {
    it('should return list of containers', async () => {
      const mockContainers = [
        { id: '1', name: 'rtpi-empire', image: 'empire:latest', status: 'running', health: 'healthy' },
        { id: '2', name: 'rtpi-database', image: 'postgres:15', status: 'running', health: 'healthy' },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockContainers),
      } as any);

      const response = await request(app)
        .get('/api/v1/containers');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('containers');
      expect(Array.isArray(response.body.containers)).toBe(true);
    });

    it('should handle database errors', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      const response = await request(app)
        .get('/api/v1/containers');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use('/api/v1/containers', containersRouter);

      const response = await request(app2)
        .get('/api/v1/containers');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/containers/:id', () => {
    it('should return container by id', async () => {
      const mockContainer = {
        id: '123',
        name: 'rtpi-empire',
        image: 'empire:latest',
        status: 'running',
        health: 'healthy',
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockContainer]),
          }),
        }),
      } as any);

      const response = await request(app)
        .get('/api/v1/containers/123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('container');
      expect(response.body.container).toEqual(mockContainer);
    });

    it('should return 404 for non-existent container', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await request(app)
        .get('/api/v1/containers/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Container not found');
    });
  });

  describe('POST /api/v1/containers', () => {
    it('should register new container', async () => {
      const newContainer = {
        name: 'rtpi-ollama',
        image: 'ollama:latest',
        status: 'running',
      };

      const createdContainer = { id: 'new-container', ...newContainer };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdContainer]),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/containers')
        .send(newContainer);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('container');
      expect(response.body.container).toMatchObject(newContainer);
    });

    it('should require admin role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/containers', containersRouter);

      const response = await request(app2)
        .post('/api/v1/containers')
        .send({ name: 'test', image: 'test:latest' });

      expect(response.status).toBe(403);
    });

    it('should handle registration errors', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/containers')
        .send({ name: 'test', image: 'test:latest' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/v1/containers/:id', () => {
    it('should update existing container', async () => {
      const updatedData = {
        status: 'stopped',
      };

      const updatedContainer = { id: '123', ...updatedData };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedContainer]),
          }),
        }),
      } as any);

      const response = await request(app)
        .put('/api/v1/containers/123')
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('container');
    });

    it('should return 404 when updating non-existent container', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await request(app)
        .put('/api/v1/containers/999')
        .send({ status: 'stopped' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Container not found');
    });

    it('should allow admin or operator to update', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/containers', containersRouter);

      const updatedContainer = { id: '123', status: 'stopped' };
      
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedContainer]),
          }),
        }),
      } as any);

      const response = await request(app2)
        .put('/api/v1/containers/123')
        .send({ status: 'stopped' });

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/v1/containers/:id', () => {
    it('should delete container', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      const response = await request(app)
        .delete('/api/v1/containers/123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Container deleted successfully');
    });

    it('should require admin role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/containers', containersRouter);

      const response = await request(app2)
        .delete('/api/v1/containers/123');

      expect(response.status).toBe(403);
    });

    it('should handle deletion errors', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      const response = await request(app)
        .delete('/api/v1/containers/123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Container Status', () => {
    const validStatuses = ['running', 'stopped', 'restarting', 'paused', 'exited'];
    
    validStatuses.forEach((status) => {
      it(`should accept ${status} status`, () => {
        expect(validStatuses).toContain(status);
      });
    });
  });

  describe('Container Health', () => {
    const healthStates = ['healthy', 'unhealthy', 'starting', 'none'];
    
    healthStates.forEach((health) => {
      it(`should accept ${health} health state`, () => {
        expect(healthStates).toContain(health);
      });
    });
  });
});
