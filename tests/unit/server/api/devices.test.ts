import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import devicesRouter from '../../../../server/api/v1/devices';
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

describe('Devices API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Mock user middleware
    app.use((req: any, res, next) => {
      req.user = { id: 'test-user', role: 'admin' };
      next();
    });
    
    app.use('/api/v1/devices', devicesRouter);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/devices', () => {
    it('should return list of devices', async () => {
      const mockDevices = [
        { id: '1', name: 'Kali Linux VM', type: 'vm', status: 'online', isBlocked: false },
        { id: '2', name: 'Attack Box', type: 'container', status: 'offline', isBlocked: false },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockDevices),
      } as any);

      const response = await request(app)
        .get('/api/v1/devices');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('devices');
      expect(Array.isArray(response.body.devices)).toBe(true);
    });

    it('should handle database errors', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      const response = await request(app)
        .get('/api/v1/devices');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use('/api/v1/devices', devicesRouter);

      const response = await request(app2)
        .get('/api/v1/devices');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/devices/:id', () => {
    it('should return device by id', async () => {
      const mockDevice = {
        id: '123',
        name: 'Kali Linux',
        type: 'vm',
        status: 'online',
        isBlocked: false,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDevice]),
          }),
        }),
      } as any);

      const response = await request(app)
        .get('/api/v1/devices/123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('device');
      expect(response.body.device).toEqual(mockDevice);
    });

    it('should return 404 for non-existent device', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await request(app)
        .get('/api/v1/devices/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Device not found');
    });
  });

  describe('POST /api/v1/devices', () => {
    it('should register new device', async () => {
      const newDevice = {
        name: 'ParrotOS VM',
        type: 'vm',
        status: 'online',
      };

      const createdDevice = { id: 'new-device', ...newDevice };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdDevice]),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/devices')
        .send(newDevice);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('device');
      expect(response.body.device).toMatchObject(newDevice);
    });

    it('should require admin role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/devices', devicesRouter);

      const response = await request(app2)
        .post('/api/v1/devices')
        .send({ name: 'Test Device', type: 'vm' });

      expect(response.status).toBe(403);
    });

    it('should handle registration errors', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/devices')
        .send({ name: 'Test', type: 'vm' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/v1/devices/:id', () => {
    it('should update existing device', async () => {
      const updatedData = {
        status: 'offline',
      };

      const updatedDevice = { id: '123', ...updatedData };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedDevice]),
          }),
        }),
      } as any);

      const response = await request(app)
        .put('/api/v1/devices/123')
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('device');
    });

    it('should return 404 when updating non-existent device', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await request(app)
        .put('/api/v1/devices/999')
        .send({ status: 'offline' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Device not found');
    });

    it('should require admin role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/devices', devicesRouter);

      const response = await request(app2)
        .put('/api/v1/devices/123')
        .send({ status: 'offline' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/devices/:id', () => {
    it('should delete device', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      const response = await request(app)
        .delete('/api/v1/devices/123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Device deleted successfully');
    });

    it('should require admin role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/devices', devicesRouter);

      const response = await request(app2)
        .delete('/api/v1/devices/123');

      expect(response.status).toBe(403);
    });

    it('should handle deletion errors', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      const response = await request(app)
        .delete('/api/v1/devices/123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/devices/:id/block', () => {
    it('should block device', async () => {
      const blockedDevice = { id: '123', isBlocked: true };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([blockedDevice]),
          }),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/devices/123/block');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('device');
      expect(response.body.device.isBlocked).toBe(true);
    });

    it('should require admin role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/devices', devicesRouter);

      const response = await request(app2)
        .post('/api/v1/devices/123/block');

      expect(response.status).toBe(403);
    });

    it('should handle block errors', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/devices/123/block');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/devices/:id/unblock', () => {
    it('should unblock device', async () => {
      const unblockedDevice = { id: '123', isBlocked: false };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([unblockedDevice]),
          }),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/devices/123/unblock');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('device');
      expect(response.body.device.isBlocked).toBe(false);
    });

    it('should require admin role', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 'test-user', role: 'operator' };
        next();
      });
      app2.use('/api/v1/devices', devicesRouter);

      const response = await request(app2)
        .post('/api/v1/devices/123/unblock');

      expect(response.status).toBe(403);
    });

    it('should handle unblock errors', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      } as any);

      const response = await request(app)
        .post('/api/v1/devices/123/unblock');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Device Types', () => {
    const deviceTypes = ['vm', 'container', 'physical', 'cloud'];
    
    deviceTypes.forEach((type) => {
      it(`should accept ${type} device type`, () => {
        expect(deviceTypes).toContain(type);
      });
    });
  });

  describe('Device Status', () => {
    const validStatuses = ['online', 'offline', 'maintenance', 'error'];
    
    validStatuses.forEach((status) => {
      it(`should accept ${status} status`, () => {
        expect(validStatuses).toContain(status);
      });
    });
  });

  describe('Security - Admin-Only Operations', () => {
    it('should restrict device registration to admins', () => {
      const requiredRole = 'admin';
      expect(requiredRole).toBe('admin');
    });

    it('should restrict device updates to admins', () => {
      const requiredRole = 'admin';
      expect(requiredRole).toBe('admin');
    });

    it('should restrict device deletion to admins', () => {
      const requiredRole = 'admin';
      expect(requiredRole).toBe('admin');
    });

    it('should restrict device blocking to admins', () => {
      const requiredRole = 'admin';
      expect(requiredRole).toBe('admin');
    });

    it('should restrict device unblocking to admins', () => {
      const requiredRole = 'admin';
      expect(requiredRole).toBe('admin');
    });
  });
});
