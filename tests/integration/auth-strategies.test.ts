import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  role: 'operator',
  isActive: true,
  googleId: null,
  authMethod: 'local',
  lastLogin: new Date('2024-01-01'),
};

const mockApiKeyRecord = {
  id: 'key-1',
  userId: 'user-1',
  keyHash: '',
  isActive: true,
  expiresAt: new Date(Date.now() + 86400000),
  lastUsed: null,
};

// DB mock setup
const mockDbSelectFromWhereLimit = vi.fn();
const mockDbSelectFromWhere = vi.fn().mockReturnValue({ limit: mockDbSelectFromWhereLimit });
const mockDbSelectFrom = vi.fn().mockReturnValue({ where: mockDbSelectFromWhere });
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

const mockDbInsertReturning = vi.fn().mockResolvedValue([]);
const mockDbInsertValues = vi.fn().mockReturnValue({ returning: mockDbInsertReturning });
const mockDbInsert = vi.fn().mockReturnValue({ values: mockDbInsertValues });

vi.mock('../../server/db', () => ({
  db: {
    select: (...args: any[]) => mockDbSelect(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
    insert: (...args: any[]) => mockDbInsert(...args),
  },
}));

vi.mock('../../server/services/empire-executor', () => ({
  empireExecutor: {
    initializeTokensForUser: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../server/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('API Key Authentication Strategy', () => {
  let apiKeyStrategy: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Re-setup mock chains after resetModules
    mockDbSelectFromWhere.mockReturnValue({ limit: mockDbSelectFromWhereLimit });
    mockDbSelectFrom.mockReturnValue({ where: mockDbSelectFromWhere });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: mockDbSelectFromWhereLimit }) }),
        where: mockDbSelectFromWhere,
      }),
    });
    mockDbUpdate.mockReturnValue({ set: mockDbUpdateSet });
    mockDbUpdateSet.mockReturnValue({ where: mockDbUpdateSetWhere });
  });

  function createCallbackCapture() {
    const done = vi.fn();
    return done;
  }

  async function runApiKeyAuth(headers: Record<string, string>) {
    const passportCustomModule = await import('passport-custom');
    const passport = (await import('../../server/auth/strategies/apikey')).default;

    const strategyInstance = (passport as any)._strategy('api-key');
    expect(strategyInstance).toBeDefined();

    const done = createCallbackCapture();
    const req = { headers } as any;

    await strategyInstance.authenticate(req, {
      success: (user: any) => done(null, user),
      fail: () => done(null, false),
      error: (err: any) => done(err),
    });

    return done;
  }

  it('should authenticate with valid API key', async () => {
    const rawKey = 'test-api-key-123';
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    mockDbSelectFromWhereLimit.mockResolvedValueOnce([{
      apiKey: { ...mockApiKeyRecord, keyHash },
      user: mockUser,
    }]);

    const passport = (await import('../../server/auth/strategies/apikey')).default;
    const strategy = (passport as any)._strategy('api-key');
    expect(strategy).toBeDefined();

    const done = vi.fn();
    await strategy._verify({ headers: { 'x-api-key': rawKey } } as any, done);

    expect(done).toHaveBeenCalledWith(null, mockUser);
  });

  it('should reject when x-api-key header is missing', async () => {
    const passport = (await import('../../server/auth/strategies/apikey')).default;
    const strategy = (passport as any)._strategy('api-key');

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

    const passport = (await import('../../server/auth/strategies/apikey')).default;
    const strategy = (passport as any)._strategy('api-key');

    const done = vi.fn();
    await strategy._verify({ headers: { 'x-api-key': rawKey } } as any, done);

    expect(done).toHaveBeenCalledWith(null, false);
  });

  it('should reject inactive users', async () => {
    const rawKey = 'inactive-user-key';
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    mockDbSelectFromWhereLimit.mockResolvedValueOnce([{
      apiKey: { ...mockApiKeyRecord, keyHash },
      user: { ...mockUser, isActive: false },
    }]);

    const passport = (await import('../../server/auth/strategies/apikey')).default;
    const strategy = (passport as any)._strategy('api-key');

    const done = vi.fn();
    await strategy._verify({ headers: { 'x-api-key': rawKey } } as any, done);

    expect(done).toHaveBeenCalledWith(null, false);
  });

  it('should reject keys not found in database', async () => {
    mockDbSelectFromWhereLimit.mockResolvedValueOnce([]);

    const passport = (await import('../../server/auth/strategies/apikey')).default;
    const strategy = (passport as any)._strategy('api-key');

    const done = vi.fn();
    await strategy._verify({ headers: { 'x-api-key': 'nonexistent' } } as any, done);

    expect(done).toHaveBeenCalledWith(null, false);
  });

  it('should update lastUsed timestamp on successful auth', async () => {
    const rawKey = 'valid-key';
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    mockDbSelectFromWhereLimit.mockResolvedValueOnce([{
      apiKey: { ...mockApiKeyRecord, id: 'key-42', keyHash },
      user: mockUser,
    }]);

    const passport = (await import('../../server/auth/strategies/apikey')).default;
    const strategy = (passport as any)._strategy('api-key');

    const done = vi.fn();
    await strategy._verify({ headers: { 'x-api-key': rawKey } } as any, done);

    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockDbUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ lastUsed: expect.any(Date) })
    );
  });
});

describe('Google OAuth Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should export isOAuthAvailable as false when env vars are not set', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const { isOAuthAvailable } = await import('../../server/auth/strategies/google');
    expect(isOAuthAvailable).toBeFalsy();
  });

  it('should export isOAuthAvailable as false when env vars are empty strings', async () => {
    process.env.GOOGLE_CLIENT_ID = '';
    process.env.GOOGLE_CLIENT_SECRET = '';

    const { isOAuthAvailable } = await import('../../server/auth/strategies/google');
    expect(isOAuthAvailable).toBeFalsy();

    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });

  it('should export isOAuthAvailable as true when env vars are set', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

    const { isOAuthAvailable } = await import('../../server/auth/strategies/google');
    expect(isOAuthAvailable).toBeTruthy();

    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });
});
