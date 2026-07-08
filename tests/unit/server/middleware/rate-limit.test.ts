import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const rateLimitConfigs: Record<string, any>[] = [];
vi.mock('express-rate-limit', () => ({
  default: (options: any) => {
    rateLimitConfigs.push(options);
    const handler = vi.fn();
    Object.assign(handler, { _options: options });
    return handler;
  },
}));

let apiLimiter: any;
let authLimiter: any;
let passwordChangeLimiter: any;

beforeEach(async () => {
  rateLimitConfigs.length = 0;
  vi.resetModules();
  const mod = await import('../../../../server/middleware/rate-limit');
  apiLimiter = mod.apiLimiter;
  authLimiter = mod.authLimiter;
  passwordChangeLimiter = mod.passwordChangeLimiter;
});

describe('Rate Limiting Middleware', () => {
  describe('apiLimiter', () => {
    it('should have a 1-minute window (60000ms)', () => {
      expect(apiLimiter._options.windowMs).toBe(60 * 1000);
    });

    it('should allow 500 requests per minute', () => {
      expect(apiLimiter._options.max).toBe(500);
    });

    it('should use standard rate-limit headers', () => {
      expect(apiLimiter._options.standardHeaders).toBe(true);
    });

    it('should not use legacy X-RateLimit headers', () => {
      expect(apiLimiter._options.legacyHeaders).toBe(false);
    });

    it('should return a descriptive error message', () => {
      expect(apiLimiter._options.message).toContain('Too many requests');
    });

    it('should skip health check endpoint', () => {
      const req = { path: '/api/v1/health' } as Partial<Request>;
      expect(apiLimiter._options.skip(req, {} as Response)).toBe(true);
    });

    it('should not skip arbitrary API endpoints', () => {
      const req = { path: '/api/v1/targets' } as Partial<Request>;
      expect(apiLimiter._options.skip(req, {} as Response)).toBe(false);
    });

    it('should skip agent-workflows for authenticated users', () => {
      const req = {
        path: '/api/v1/agent-workflows',
        isAuthenticated: () => true,
      } as any;
      expect(apiLimiter._options.skip(req, {} as Response)).toBe(true);
    });

    it('should not skip agent-workflows for unauthenticated users', () => {
      const req = {
        path: '/api/v1/agent-workflows',
        isAuthenticated: () => false,
      } as any;
      expect(apiLimiter._options.skip(req, {} as Response)).toBe(false);
    });
  });

  describe('authLimiter', () => {
    it('should have a 15-minute window', () => {
      expect(authLimiter._options.windowMs).toBe(15 * 60 * 1000);
    });

    it('should allow 5 attempts per window', () => {
      expect(authLimiter._options.max).toBe(5);
    });

    it('should skip successful requests', () => {
      expect(authLimiter._options.skipSuccessfulRequests).toBe(true);
    });

    it('should return an auth-specific error message', () => {
      expect(authLimiter._options.message).toContain('authentication attempts');
    });
  });

  describe('passwordChangeLimiter', () => {
    it('should have a 1-hour window', () => {
      expect(passwordChangeLimiter._options.windowMs).toBe(60 * 60 * 1000);
    });

    it('should allow 3 changes per hour', () => {
      expect(passwordChangeLimiter._options.max).toBe(3);
    });

    it('should return a password-specific error message', () => {
      expect(passwordChangeLimiter._options.message).toContain('password change');
    });
  });

  describe('middleware exports', () => {
    it('should export all three limiters', () => {
      expect(apiLimiter).toBeDefined();
      expect(authLimiter).toBeDefined();
      expect(passwordChangeLimiter).toBeDefined();
    });
  });
});
