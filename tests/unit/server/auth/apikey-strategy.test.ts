import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  role: 'operator',
  isActive: true,
  googleId: null,
  authMethod: 'api_key',
  lastLogin: new Date('2024-01-01'),
};

const mockApiKeyRecord = {
  id: 'key-1',
  userId: 'user-1',
  keyHash: '',
  isActive: true,
  expiresAt: new Date(Date.now() + 86400000),
  lastUsed: null,
  rateLimit: 100,
};

const mockDbSelectFromWhereLimit = vi.fn();
const mockDbSelectFromWhere = vi.fn().mockReturnValue({ limit: mockDbSelectFromWhereLimit });
const mockDbSelectInnerJoin = vi.fn().mockReturnValue({ where: mockDbSelectFromWhere });
const mockDbSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    innerJoin: mockDbSelectInnerJoin,
    where: mockDbSelectFromWhere,
  }),
});

const mockDbUpdateSetWhere = vi.fn().mockResolvedValue(undefined);
const mockDbUpdateSet = vi.fn().mockReturnValue({ where: mockDbUpdateSetWhere });
const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbUpdateSet });

vi.mock('../../../../server/db', () => ({
  db: {
    select: (...args: any[]) => mockDbSelect(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
  },
}));

const mockRedisIncr = vi.fn().mockResolvedValue(1);
const mockRedisExpire = vi.fn().mockResolvedValue(true);

vi.mock('../../../../server/auth/session', () => ({
  redisClient: {
    incr: (...args: any[]) => mockRedisIncr(...args),
    expire: (...args: any[]) => mockRedisExpire(...args),
  },
}));

vi.mock('../../../../server/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('API Key Authentication Strategy', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    mockDbSelectFromWhere.mockReturnValue({ limit: mockDbSelectFromWhereLimit });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: mockDbSelectFromWhereLimit }) }),
        where: mockDbSelectFromWhere,
      }),
    });
    mockDbUpdate.mockReturnValue({ set: mockDbUpdateSet });
    mockDbUpdateSet.mockReturnValue({ where: mockDbUpdateSetWhere });
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(true);
  });

  async function getStrategy() {
    const passport = (await import('../../../../server/auth/strategies/apikey')).default;
    const strategy = (passport as any)._strategy('api-key');
    expect(strategy).toBeDefined();
    return strategy;
  }

  describe('SHA256 Key Hashing', () => {
    it('should hash the provided key with SHA256 before DB lookup', async () => {
      const rawKey = 'my-secret-api-key';
      const expectedHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockDbSelectFromWhereLimit.mockResolvedValueOnce([{
        apiKey: { ...mockApiKeyRecord, keyHash: expectedHash },
        user: mockUser,
      }]);

      const strategy = await getStrategy();
      const done = vi.fn();
      await strategy._verify({ headers: { 'x-api-key': rawKey } } as any, done);

      expect(done).toHaveBeenCalledWith(null, mockUser);
      expect(expectedHash).toHaveLength(64);
    });

    it('should produce consistent hashes for the same key', () => {
      const key = 'test-key';
      const hash1 = crypto.createHash('sha256').update(key).digest('hex');
      const hash2 = crypto.createHash('sha256').update(key).digest('hex');
      expect(hash1).toBe(hash2);
    });
  });

  describe('Valid Key Authentication', () => {
    it('should authenticate and return user for valid active key', async () => {
      const rawKey = 'valid-api-key';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockDbSelectFromWhereLimit.mockResolvedValueOnce([{
        apiKey: { ...mockApiKeyRecord, keyHash },
        user: mockUser,
      }]);

      const strategy = await getStrategy();
      const done = vi.fn();
      await strategy._verify({ headers: { 'x-api-key': rawKey } } as any, done);

      expect(done).toHaveBeenCalledWith(null, mockUser);
    });

    it('should authenticate keys with null expiresAt (no expiration)', async () => {
      const rawKey = 'no-expiry-key';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockDbSelectFromWhereLimit.mockResolvedValueOnce([{
        apiKey: { ...mockApiKeyRecord, keyHash, expiresAt: null },
        user: mockUser,
      }]);

      const strategy = await getStrategy();
      const done = vi.fn();
      await strategy._verify({ headers: { 'x-api-key': rawKey } } as any, done);

      expect(done).toHaveBeenCalledWith(null, mockUser);
    });
  });

  describe('Key Rejection', () => {
    it('should reject when x-api-key header is missing', async () => {
      const strategy = await getStrategy();
      const done = vi.fn();
      await strategy._verify({ headers: {} } as any, done);

      expect(done).toHaveBeenCalledWith(null, false);
    });

    it('should reject expired API keys', async () => {
      const rawKey = 'expired-key';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockDbSelectFromWhereLimit.mockResolvedValueOnce([{
        apiKey: { ...mockApiKeyRecord, keyHash, expiresAt: new Date('2020-01-01') },
        user: mockUser,
      }]);

      const strategy = await getStrategy();
      const done = vi.fn();
      await strategy._verify({ headers: { 'x-api-key': rawKey } } as any, done);

      expect(done).toHaveBeenCalledWith(null, false);
    });

    it('should reject revoked (inactive) API keys', async () => {
      const rawKey = 'revoked-key';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockDbSelectFromWhereLimit.mockResolvedValueOnce([]);

      const strategy = await getStrategy();
      const done = vi.fn();
      await strategy._verify({ headers: { 'x-api-key': rawKey } } as any, done);

      expect(done).toHaveBeenCalledWith(null, false);
    });

    it('should reject when user account is inactive', async () => {
      const rawKey = 'disabled-user-key';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockDbSelectFromWhereLimit.mockResolvedValueOnce([{
        apiKey: { ...mockApiKeyRecord, keyHash },
        user: { ...mockUser, isActive: false },
      }]);

      const strategy = await getStrategy();
      const done = vi.fn();
      await strategy._verify({ headers: { 'x-api-key': rawKey } } as any, done);

      expect(done).toHaveBeenCalledWith(null, false);
    });

    it('should reject keys not found in database', async () => {
      mockDbSelectFromWhereLimit.mockResolvedValueOnce([]);

      const strategy = await getStrategy();
      const done = vi.fn();
      await strategy._verify({ headers: { 'x-api-key': 'nonexistent' } } as any, done);

      expect(done).toHaveBeenCalledWith(null, false);
    });
  });

  describe('Last Used Tracking', () => {
    it('should update lastUsed timestamp on successful auth', async () => {
      const rawKey = 'tracked-key';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockDbSelectFromWhereLimit.mockResolvedValueOnce([{
        apiKey: { ...mockApiKeyRecord, id: 'key-42', keyHash },
        user: mockUser,
      }]);

      const strategy = await getStrategy();
      const done = vi.fn();
      await strategy._verify({ headers: { 'x-api-key': rawKey } } as any, done);

      expect(mockDbUpdate).toHaveBeenCalled();
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ lastUsed: expect.any(Date) })
      );
    });
  });

  describe('Per-Key Rate Limiting', () => {
    it('should allow requests within the rate limit', async () => {
      const rawKey = 'rate-limited-key';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockDbSelectFromWhereLimit.mockResolvedValueOnce([{
        apiKey: { ...mockApiKeyRecord, keyHash, rateLimit: 100 },
        user: mockUser,
      }]);
      mockRedisIncr.mockResolvedValueOnce(50);

      const strategy = await getStrategy();
      const done = vi.fn();
      await strategy._verify({ headers: { 'x-api-key': rawKey } } as any, done);

      expect(done).toHaveBeenCalledWith(null, mockUser);
      expect(mockRedisIncr).toHaveBeenCalledWith('apikey-rl:key-1');
    });

    it('should reject requests exceeding the rate limit', async () => {
      const rawKey = 'over-limit-key';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockDbSelectFromWhereLimit.mockResolvedValueOnce([{
        apiKey: { ...mockApiKeyRecord, keyHash, rateLimit: 100 },
        user: mockUser,
      }]);
      mockRedisIncr.mockResolvedValueOnce(101);

      const strategy = await getStrategy();
      const done = vi.fn();
      await strategy._verify({ headers: { 'x-api-key': rawKey } } as any, done);

      expect(done).toHaveBeenCalledWith(null, false);
    });

    it('should set TTL on first request in window', async () => {
      const rawKey = 'first-request-key';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockDbSelectFromWhereLimit.mockResolvedValueOnce([{
        apiKey: { ...mockApiKeyRecord, keyHash, rateLimit: 100 },
        user: mockUser,
      }]);
      mockRedisIncr.mockResolvedValueOnce(1);

      const strategy = await getStrategy();
      const done = vi.fn();
      await strategy._verify({ headers: { 'x-api-key': rawKey } } as any, done);

      expect(mockRedisExpire).toHaveBeenCalledWith('apikey-rl:key-1', 60);
    });

    it('should not set TTL on subsequent requests', async () => {
      const rawKey = 'subsequent-key';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockDbSelectFromWhereLimit.mockResolvedValueOnce([{
        apiKey: { ...mockApiKeyRecord, keyHash, rateLimit: 100 },
        user: mockUser,
      }]);
      mockRedisIncr.mockResolvedValueOnce(5);

      const strategy = await getStrategy();
      const done = vi.fn();
      await strategy._verify({ headers: { 'x-api-key': rawKey } } as any, done);

      expect(mockRedisExpire).not.toHaveBeenCalled();
    });

    it('should fail open when Redis is unavailable', async () => {
      const rawKey = 'redis-down-key';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockDbSelectFromWhereLimit.mockResolvedValueOnce([{
        apiKey: { ...mockApiKeyRecord, keyHash, rateLimit: 100 },
        user: mockUser,
      }]);
      mockRedisIncr.mockRejectedValueOnce(new Error('Redis connection refused'));

      const strategy = await getStrategy();
      const done = vi.fn();
      await strategy._verify({ headers: { 'x-api-key': rawKey } } as any, done);

      expect(done).toHaveBeenCalledWith(null, mockUser);
    });
  });

  describe('Error Handling', () => {
    it('should pass database errors to done callback', async () => {
      const dbError = new Error('DB connection failed');
      mockDbSelectFromWhereLimit.mockRejectedValueOnce(dbError);

      const strategy = await getStrategy();
      const done = vi.fn();
      await strategy._verify({ headers: { 'x-api-key': 'any-key' } } as any, done);

      expect(done).toHaveBeenCalledWith(dbError);
    });
  });
});
