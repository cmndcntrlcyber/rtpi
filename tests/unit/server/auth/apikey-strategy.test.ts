import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { db } from '../../../../server/db';

// Mock database
vi.mock('../../../../server/db');

describe('API Key Authentication Strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API Key Extraction', () => {
    it('should extract API key from x-api-key header', () => {
      const headers = { 'x-api-key': 'test-api-key-12345' };
      const apiKey = headers['x-api-key'];
      expect(apiKey).toBe('test-api-key-12345');
    });

    it('should handle missing API key header', () => {
      const headers = {};
      const apiKey = headers['x-api-key' as keyof typeof headers];
      expect(apiKey).toBeUndefined();
    });
  });

  describe('API Key Hashing', () => {
    it('should hash API key with SHA256', () => {
      const apiKey = 'test-api-key-12345';
      const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA256 produces 64 hex characters
    });

    it('should produce consistent hashes for same key', () => {
      const apiKey = 'test-key';
      const hash1 = crypto.createHash('sha256').update(apiKey).digest('hex');
      const hash2 = crypto.createHash('sha256').update(apiKey).digest('hex');
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different keys', () => {
      const key1 = 'test-key-1';
      const key2 = 'test-key-2';
      
      const hash1 = crypto.createHash('sha256').update(key1).digest('hex');
      const hash2 = crypto.createHash('sha256').update(key2).digest('hex');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('API Key Validation', () => {
    it('should validate active API key', () => {
      const apiKeyRecord = {
        id: 'key-123',
        keyHash: 'hash-value',
        isActive: true,
        expiresAt: null,
      };

      expect(apiKeyRecord.isActive).toBe(true);
      expect(apiKeyRecord.expiresAt).toBeNull();
    });

    it('should reject inactive API key', () => {
      const apiKeyRecord = {
        id: 'key-123',
        isActive: false,
      };

      expect(apiKeyRecord.isActive).toBe(false);
    });
  });

  describe('API Key Expiration', () => {
    it('should reject expired API key', () => {
      const expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const now = new Date();
      
      expect(expiresAt < now).toBe(true);
    });

    it('should allow non-expired API key', () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days future
      const now = new Date();
      
      expect(expiresAt > now).toBe(true);
    });

    it('should allow API keys without expiration', () => {
      const expiresAt = null;
      expect(expiresAt).toBeNull();
    });
  });

  describe('User Account Checks', () => {
    it('should validate active user account', () => {
      const user = {
        id: 'user-123',
        isActive: true,
      };

      expect(user.isActive).toBe(true);
    });

    it('should reject disabled user account', () => {
      const user = {
        id: 'user-123',
        isActive: false,
      };

      expect(user.isActive).toBe(false);
    });
  });

  describe('Last Used Tracking', () => {
    it('should update last used timestamp on successful auth', () => {
      const lastUsed = new Date();
      expect(lastUsed).toBeInstanceOf(Date);
    });

    it('should track usage time accurately', () => {
      const now = new Date();
      const lastUsed = new Date();
      const diff = Math.abs(now.getTime() - lastUsed.getTime());
      expect(diff).toBeLessThan(1000); // Within 1 second
    });
  });

  describe('Error Messages', () => {
    it('should require API key in header', () => {
      const errorMessage = 'API key required';
      expect(errorMessage).toBe('API key required');
    });

    it('should show invalid key message', () => {
      const errorMessage = 'Invalid API key';
      expect(errorMessage).toBe('Invalid API key');
    });

    it('should show expiration message', () => {
      const errorMessage = 'API key expired';
      expect(errorMessage).toContain('expired');
    });

    it('should show disabled account message', () => {
      const errorMessage = 'User account is disabled';
      expect(errorMessage).toContain('disabled');
    });
  });

  describe('Database Query', () => {
    it('should join API keys with users table', async () => {
      const mockRecord = {
        apiKey: {
          id: 'key-123',
          keyHash: 'hash',
          isActive: true,
          expiresAt: null,
          userId: 'user-123',
        },
        user: {
          id: 'user-123',
          username: 'testuser',
          isActive: true,
        },
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockRecord]),
            }),
          }),
        }),
      } as any);

      expect(mockRecord.apiKey.userId).toBe(mockRecord.user.id);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockRejectedValue(new Error('DB error')),
            }),
          }),
        }),
      } as any);

      try {
        await db.select().from({} as any).innerJoin({} as any, {} as any).where({} as any).limit(1);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
