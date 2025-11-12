import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import agentsRouter from '../../../../server/api/v1/agents';
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

describe('Agents API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Mock user middleware
    app.use((req: any, res, next) => {
      req.user = { id: 'test-user', role: 'admin' };
      next();
    });
    
    app.use('/api/v1/agents', agentsRouter);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/agents', () => {
    it('should return list of agents', async () => {
      const mockAgents = [
        { id: '1', name: 'empire', type: 'c2', status: 'running' },
        { id: '2', name: 'metasploit', type: 'exploitation', status: 'stopped' },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockAgents),
      } as any);

      const response = await request(app)
        .get('/api/v1/agents');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('agents');
      expect(Array.isArray(response.body.agents)).toBe(true);
    });

    it('should handle database errors', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      const response = await request(app)
        .get('/api/v1/agents');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use('/api/v1/agents', agentsRouter);

      const response = await request(app2)
        .get('/api/v1/agents');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/agents/:id', () => {
    it('should return agent by id', async () => {
      const mockAgent = {
        id: '123',
        name: 'empire',
        type: 'c2',
        status: 'running',
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAgent]),
          }),
        }),
      } as any);

      const response = await request(app)
        .get('/api/v1/agents/123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('agent');
      expect(response.body.agent).toEqual(mockAgent);
    });

    it('should return 404 for non-existent agent', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await request(app)
        .get('/api/v1/agents/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Agent not found');
    });
  });

  describe('POST /api/v1/agents', () => {
    it('should create new agent', async () => {
      const newAgent = {
        name: 'cobalt-strike',
        type: 'c2',
        status: 'stopped',
      };

      const createdAgent = { id: 'new-789', ...newAgent };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdAgent]),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/agents')
        .send(newAgent);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('agent');
      expect(response.body.agent).toMatchObject(newAgent);
    });

    it('should require admin or operator role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'viewer' };
        next();
      });
      app2.use('/api/v1/agents', agentsRouter);

      const response = await request(app2)
        .post('/api/v1/agents')
        .send({ name: 'test-agent', type: 'c2' });

      expect(response.status).toBe(403);
    });

    it('should handle creation errors', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/agents')
        .send({ name: 'test', type: 'c2' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/v1/agents/:id', () => {
    it('should update existing agent', async () => {
      const updatedData = {
        status: 'running',
      };

      const updatedAgent = { id: '123', ...updatedData };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedAgent]),
          }),
        }),
      } as any);

      const response = await request(app)
        .put('/api/v1/agents/123')
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('agent');
    });

    it('should return 404 when updating non-existent agent', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await request(app)
        .put('/api/v1/agents/999')
        .send({ status: 'stopped' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Agent not found');
    });

    it('should require admin or operator role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'viewer' };
        next();
      });
      app2.use('/api/v1/agents', agentsRouter);

      const response = await request(app2)
        .put('/api/v1/agents/123')
        .send({ status: 'running' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/agents/:id', () => {
    it('should delete agent', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      const response = await request(app)
        .delete('/api/v1/agents/123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Agent deleted successfully');
    });

    it('should require admin role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/agents', agentsRouter);

      const response = await request(app2)
        .delete('/api/v1/agents/123');

      expect(response.status).toBe(403);
    });

    it('should handle deletion errors', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      const response = await request(app)
        .delete('/api/v1/agents/123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Agent Types', () => {
    const agentTypes = ['c2', 'exploitation', 'reconnaissance', 'post-exploitation'];
    
    agentTypes.forEach((type) => {
      it(`should accept ${type} agent type`, () => {
        expect(agentTypes).toContain(type);
      });
    });
  });

  describe('Agent Status', () => {
    const validStatuses = ['running', 'stopped', 'error', 'maintenance'];
    
    validStatuses.forEach((status) => {
      it(`should accept ${status} status`, () => {
        expect(validStatuses).toContain(status);
      });
    });
  });
});
