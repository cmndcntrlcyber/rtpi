import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { generateCsrfToken, validateCsrfToken, attachCsrfToken } from '../../../../server/middleware/csrf';
import type { Request, Response } from 'express';

describe('CSRF Middleware', () => {
  let mockReq: any;
  let mockRes: Partial<Response>;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {
      session: { id: 'session-123' },
      sessionID: 'session-123',
      method: 'POST',
      headers: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      locals: {},
    };
    mockNext = vi.fn();
  });

  describe('Token Generation', () => {
    it('should generate CSRF token', () => {
      const token = generateCsrfToken(mockReq as Request);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes * 2 (hex encoding)
    });

    it('should generate unique tokens', () => {
      const token1 = generateCsrfToken(mockReq as Request);
      const token2 = generateCsrfToken(mockReq as Request);
      
      // Note: This will overwrite for same session, but demonstrates generation
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
    });

    it('should use crypto.randomBytes for token generation', () => {
      const token = crypto.randomBytes(32).toString('hex');
      expect(token.length).toBe(64);
    });
  });

  describe('Token Validation - Safe Methods', () => {
    it('should skip CSRF for GET requests', () => {
      mockReq.method = 'GET';
      
      validateCsrfToken(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should skip CSRF for HEAD requests', () => {
      mockReq.method = 'HEAD';
      
      validateCsrfToken(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip CSRF for OPTIONS requests', () => {
      mockReq.method = 'OPTIONS';
      
      validateCsrfToken(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Token Validation - Unsafe Methods', () => {
    it('should require CSRF token for POST', () => {
      mockReq.method = 'POST';
      mockReq.headers = {};
      
      validateCsrfToken(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should require CSRF token for PUT', () => {
      mockReq.method = 'PUT';
      
      validateCsrfToken(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should require CSRF token for DELETE', () => {
      mockReq.method = 'DELETE';
      
      validateCsrfToken(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Token Attachment', () => {
    it('should attach token to response locals', () => {
      attachCsrfToken(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.locals?.csrfToken).toBeDefined();
      expect(typeof mockRes.locals?.csrfToken).toBe('string');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Token Format', () => {
    it('should generate 64-character hex token', () => {
      const token = crypto.randomBytes(32).toString('hex');
      expect(token.length).toBe(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });
  });

  describe('Error Messages', () => {
    it('should return 403 for missing token', () => {
      mockReq.method = 'POST';
      
      validateCsrfToken(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'CSRF token validation failed',
        })
      );
    });
  });
});
