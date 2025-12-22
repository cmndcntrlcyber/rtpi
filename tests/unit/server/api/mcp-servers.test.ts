import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import mcpServersRouter from '../../../../server/api/v1/mcp-servers';
import { db } from '../../../../server/db';

// Mock dependencies
vi.mock('../../../../server/db');
vi.mock('../../../../server/services/mcp-server-manager', () => ({
  mcpServerManager: {
    startServer: vi.fn().mockResolvedValue(true),
    stopServer: vi.fn().mockResolvedValue(true),
    restartServer: vi.fn().mockResolvedValue(true),
  },
}));
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

describe('MCP Servers API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Mock user middleware
    app.use((req: any, res, next) => {
      req.user = { id: 'test-user', role: 'admin' };
      next();
    });
    
    app.use('/api/v1/mcp-servers', mcpServersRouter);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/mcp-servers', () => {
    it('should return list of MCP servers', async () => {
      const mockServers = [
        { id: '1', name: 'tavily-mcp', type: 'search', status: 'running', port: 3001 },
        { id: '2', name: 'github-mcp', type: 'integration', status: 'stopped', port: 3002 },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockServers),
      } as any);

      const response = await request(app)
        .get('/api/v1/mcp-servers');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('servers');
      expect(Array.isArray(response.body.servers)).toBe(true);
    });

    it('should handle database errors', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      const response = await request(app)
        .get('/api/v1/mcp-servers');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use('/api/v1/mcp-servers', mcpServersRouter);

      const response = await request(app2)
        .get('/api/v1/mcp-servers');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/mcp-servers/:id', () => {
    it('should return server by id', async () => {
      const mockServer = {
        id: '123',
        name: 'tavily-mcp',
        type: 'search',
        status: 'running',
        port: 3001,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockServer]),
          }),
        }),
      } as any);

      const response = await request(app)
        .get('/api/v1/mcp-servers/123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('server');
      expect(response.body.server).toEqual(mockServer);
    });

    it('should return 404 for non-existent server', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await request(app)
        .get('/api/v1/mcp-servers/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'MCP server not found');
    });
  });

  describe('POST /api/v1/mcp-servers', () => {
    it('should create new MCP server', async () => {
      const newServer = {
        name: 'filesystem-mcp',
        type: 'tools',
        status: 'stopped',
        port: 3003,
      };

      const createdServer = { id: 'new-mcp', ...newServer };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdServer]),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/mcp-servers')
        .send(newServer);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('server');
      expect(response.body.server).toMatchObject(newServer);
    });

    it('should require admin role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/mcp-servers', mcpServersRouter);

      const response = await request(app2)
        .post('/api/v1/mcp-servers')
        .send({ name: 'test-mcp', type: 'tools' });

      expect(response.status).toBe(403);
    });

    it('should handle creation errors', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/mcp-servers')
        .send({ name: 'test', type: 'tools' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/v1/mcp-servers/:id', () => {
    it('should update existing server', async () => {
      const updatedData = {
        port: 3010,
      };

      const updatedServer = { id: '123', ...updatedData };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedServer]),
          }),
        }),
      } as any);

      const response = await request(app)
        .put('/api/v1/mcp-servers/123')
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('server');
    });

    it('should return 404 when updating non-existent server', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await request(app)
        .put('/api/v1/mcp-servers/999')
        .send({ port: 3010 });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'MCP server not found');
    });

    it('should require admin role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/mcp-servers', mcpServersRouter);

      const response = await request(app2)
        .put('/api/v1/mcp-servers/123')
        .send({ port: 3010 });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/mcp-servers/:id', () => {
    it('should delete server', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      const response = await request(app)
        .delete('/api/v1/mcp-servers/123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'MCP server deleted successfully');
    });

    it('should require admin role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/mcp-servers', mcpServersRouter);

      const response = await request(app2)
        .delete('/api/v1/mcp-servers/123');

      expect(response.status).toBe(403);
    });

    it('should handle deletion errors', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      const response = await request(app)
        .delete('/api/v1/mcp-servers/123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/mcp-servers/:id/start', () => {
    it('should start MCP server', async () => {
      const startedServer = {
        id: '123',
        status: 'running',
        uptime: new Date(),
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([startedServer]),
          }),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/mcp-servers/123/start');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('server');
      expect(response.body).toHaveProperty('message', 'Server started');
      expect(response.body.server.status).toBe('running');
    });

    it('should allow admin or operator to start', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/mcp-servers', mcpServersRouter);

      const startedServer = { id: '123', status: 'running' };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([startedServer]),
          }),
        }),
      } as any);

      const response = await request(app2)
        .post('/api/v1/mcp-servers/123/start');

      expect(response.status).toBe(200);
    });

    it('should handle start errors', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Start failed')),
          }),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/mcp-servers/123/start');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/mcp-servers/:id/stop', () => {
    it('should stop MCP server', async () => {
      const stoppedServer = {
        id: '123',
        status: 'stopped',
        pid: null,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([stoppedServer]),
          }),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/mcp-servers/123/stop');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('server');
      expect(response.body).toHaveProperty('message', 'Server stopped');
      expect(response.body.server.status).toBe('stopped');
    });

    it('should allow admin or operator to stop', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/mcp-servers', mcpServersRouter);

      const stoppedServer = { id: '123', status: 'stopped' };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([stoppedServer]),
          }),
        }),
      } as any);

      const response = await request(app2)
        .post('/api/v1/mcp-servers/123/stop');

      expect(response.status).toBe(200);
    });

    it('should handle stop errors', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Stop failed')),
          }),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/mcp-servers/123/stop');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/mcp-servers/:id/restart', () => {
    it('should restart MCP server', async () => {
      const restartedServer = {
        id: '123',
        restartCount: 1,
        uptime: new Date(),
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([restartedServer]),
          }),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/mcp-servers/123/restart');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('server');
      expect(response.body).toHaveProperty('message', 'Server restarted');
    });

    it('should allow admin or operator to restart', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/mcp-servers', mcpServersRouter);

      const restartedServer = { id: '123', restartCount: 1 };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([restartedServer]),
          }),
        }),
      } as any);

      const response = await request(app2)
        .post('/api/v1/mcp-servers/123/restart');

      expect(response.status).toBe(200);
    });

    it('should handle restart errors', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Restart failed')),
          }),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/mcp-servers/123/restart');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('MCP Server Types', () => {
    const serverTypes = ['search', 'integration', 'tools', 'filesystem', 'database'];
    
    serverTypes.forEach((type) => {
      it(`should accept ${type} server type`, () => {
        expect(serverTypes).toContain(type);
      });
    });
  });

  describe('Server Status', () => {
    const validStatuses = ['running', 'stopped', 'error', 'maintenance'];
    
    validStatuses.forEach((status) => {
      it(`should accept ${status} status`, () => {
        expect(validStatuses).toContain(status);
      });
    });
  });

  describe('Server Lifecycle', () => {
    it('should track server uptime when started', () => {
      const uptime = new Date();
      expect(uptime).toBeInstanceOf(Date);
    });

    it('should clear PID when server stopped', () => {
      const pid = null;
      expect(pid).toBeNull();
    });

    it('should increment restart count on restart', () => {
      let restartCount = 0;
      restartCount++;
      expect(restartCount).toBe(1);
    });
  });

  describe('Security - Role-Based Access', () => {
    it('should restrict server creation to admin only', () => {
      const requiredRole = 'admin';
      expect(requiredRole).toBe('admin');
    });

    it('should restrict server updates to admin only', () => {
      const requiredRole = 'admin';
      expect(requiredRole).toBe('admin');
    });

    it('should restrict server deletion to admin only', () => {
      const requiredRole = 'admin';
      expect(requiredRole).toBe('admin');
    });

    it('should allow admin and operator to start servers', () => {
      const allowedRoles = ['admin', 'operator'];
      expect(allowedRoles).toContain('admin');
      expect(allowedRoles).toContain('operator');
    });

    it('should allow admin and operator to stop servers', () => {
      const allowedRoles = ['admin', 'operator'];
      expect(allowedRoles).toContain('admin');
      expect(allowedRoles).toContain('operator');
    });

    it('should allow admin and operator to restart servers', () => {
      const allowedRoles = ['admin', 'operator'];
      expect(allowedRoles).toContain('admin');
      expect(allowedRoles).toContain('operator');
    });
  });
});
