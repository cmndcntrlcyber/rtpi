import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  role: 'operator',
  isActive: true,
  googleId: 'google-123456',
  authMethod: 'google_oauth',
  lastLogin: new Date('2024-01-01'),
  mustChangePassword: false,
};

const mockDbSelectFromWhereLimit = vi.fn();
const mockDbSelectFromWhere = vi.fn().mockReturnValue({ limit: mockDbSelectFromWhereLimit });
const mockDbSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: mockDbSelectFromWhere,
  }),
});

const mockDbUpdateSetWhere = vi.fn().mockResolvedValue(undefined);
const mockDbUpdateSet = vi.fn().mockReturnValue({ where: mockDbUpdateSetWhere });
const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbUpdateSet });

const mockDbInsertReturning = vi.fn().mockResolvedValue([]);
const mockDbInsertValues = vi.fn().mockReturnValue({ returning: mockDbInsertReturning });
const mockDbInsert = vi.fn().mockReturnValue({ values: mockDbInsertValues });

vi.mock('../../../../server/db', () => ({
  db: {
    select: (...args: any[]) => mockDbSelect(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
    insert: (...args: any[]) => mockDbInsert(...args),
  },
}));

const mockInitializeTokens = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../server/services/empire-executor', () => ({
  empireExecutor: {
    initializeTokensForUser: (...args: any[]) => mockInitializeTokens(...args),
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

function makeProfile(overrides: Record<string, any> = {}) {
  return {
    id: 'google-123456',
    displayName: 'Test User',
    emails: [{ value: 'test@example.com', verified: true }],
    ...overrides,
  };
}

function resetDbMockChains() {
  mockDbSelectFromWhere.mockReturnValue({ limit: mockDbSelectFromWhereLimit });
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: mockDbSelectFromWhere,
    }),
  });
  mockDbUpdate.mockReturnValue({ set: mockDbUpdateSet });
  mockDbUpdateSet.mockReturnValue({ where: mockDbUpdateSetWhere });
  mockDbInsert.mockReturnValue({ values: mockDbInsertValues });
  mockDbInsertValues.mockReturnValue({ returning: mockDbInsertReturning });
}

describe('Google OAuth Strategy', () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    resetDbMockChains();

    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  });

  afterEach(() => {
    if (originalClientId) process.env.GOOGLE_CLIENT_ID = originalClientId;
    else delete process.env.GOOGLE_CLIENT_ID;
    if (originalClientSecret) process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
    else delete process.env.GOOGLE_CLIENT_SECRET;
  });

  async function getVerifyCallback() {
    const mod = await import('../../../../server/auth/strategies/google');
    const passport = mod.default;
    const strategy = (passport as any)._strategy('google');
    expect(strategy).toBeDefined();
    return strategy._verify;
  }

  describe('Existing User by Google ID', () => {
    it('should authenticate user found by googleId and update lastLogin', async () => {
      mockDbSelectFromWhereLimit.mockResolvedValueOnce([mockUser]);

      const verify = await getVerifyCallback();
      const done = vi.fn();
      await verify('access-token', 'refresh-token', makeProfile(), done);

      expect(done).toHaveBeenCalledWith(null, mockUser);
      expect(mockDbUpdate).toHaveBeenCalled();
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ lastLogin: expect.any(Date) })
      );
    });
  });

  describe('Account Linking by Email', () => {
    it('should link Google account to existing user found by email', async () => {
      const existingUser = { ...mockUser, googleId: null, authMethod: 'local' };
      const linkedUser = { ...mockUser, authMethod: 'google_oauth' };

      // First query (by googleId): not found
      mockDbSelectFromWhereLimit.mockResolvedValueOnce([]);
      // Second query (by email): found
      mockDbSelectFromWhereLimit.mockResolvedValueOnce([existingUser]);
      // Third query (re-fetch after update): returns linked user
      mockDbSelectFromWhereLimit.mockResolvedValueOnce([linkedUser]);

      const verify = await getVerifyCallback();
      const done = vi.fn();
      await verify('access-token', 'refresh-token', makeProfile(), done);

      expect(mockDbUpdate).toHaveBeenCalled();
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          googleId: 'google-123456',
          authMethod: 'google_oauth',
          lastLogin: expect.any(Date),
        })
      );
      expect(done).toHaveBeenCalledWith(null, linkedUser);
    });
  });

  describe('New User Creation', () => {
    it('should create a new user when no match by googleId or email', async () => {
      const newUser = { ...mockUser, id: 'new-user-1', username: 'test' };

      // First query (by googleId): not found
      mockDbSelectFromWhereLimit.mockResolvedValueOnce([]);
      // Second query (by email): not found
      mockDbSelectFromWhereLimit.mockResolvedValueOnce([]);
      // Insert returns new user
      mockDbInsertReturning.mockResolvedValueOnce([newUser]);

      const verify = await getVerifyCallback();
      const done = vi.fn();
      await verify('access-token', 'refresh-token', makeProfile(), done);

      expect(mockDbInsert).toHaveBeenCalled();
      expect(mockDbInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'test',
          email: 'test@example.com',
          googleId: 'google-123456',
          authMethod: 'google_oauth',
          role: 'operator',
          isActive: true,
          mustChangePassword: false,
        })
      );
      expect(done).toHaveBeenCalledWith(null, newUser);
    });

    it('should derive username from email prefix', async () => {
      const newUser = { ...mockUser, id: 'new-user-2', username: 'john.doe' };
      const profile = makeProfile({
        emails: [{ value: 'john.doe@company.com' }],
      });

      mockDbSelectFromWhereLimit.mockResolvedValueOnce([]);
      mockDbSelectFromWhereLimit.mockResolvedValueOnce([]);
      mockDbInsertReturning.mockResolvedValueOnce([newUser]);

      const verify = await getVerifyCallback();
      const done = vi.fn();
      await verify('access-token', 'refresh-token', profile, done);

      expect(mockDbInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'john.doe' })
      );
    });

    it('should initialize Empire tokens for new user', async () => {
      const newUser = { ...mockUser, id: 'new-user-3' };

      mockDbSelectFromWhereLimit.mockResolvedValueOnce([]);
      mockDbSelectFromWhereLimit.mockResolvedValueOnce([]);
      mockDbInsertReturning.mockResolvedValueOnce([newUser]);

      const verify = await getVerifyCallback();
      const done = vi.fn();
      await verify('access-token', 'refresh-token', makeProfile(), done);

      expect(mockInitializeTokens).toHaveBeenCalledWith('new-user-3');
    });

    it('should set default role to operator for new users', async () => {
      const newUser = { ...mockUser, id: 'new-user-4' };

      mockDbSelectFromWhereLimit.mockResolvedValueOnce([]);
      mockDbSelectFromWhereLimit.mockResolvedValueOnce([]);
      mockDbInsertReturning.mockResolvedValueOnce([newUser]);

      const verify = await getVerifyCallback();
      const done = vi.fn();
      await verify('access-token', 'refresh-token', makeProfile(), done);

      expect(mockDbInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'operator' })
      );
    });
  });

  describe('Error Handling', () => {
    it('should reject profile with no email', async () => {
      const profile = makeProfile({ emails: undefined });

      const verify = await getVerifyCallback();
      const done = vi.fn();
      await verify('access-token', 'refresh-token', profile, done);

      expect(done).toHaveBeenCalledWith(expect.any(Error));
      expect(done.mock.calls[0][0].message).toContain('No email');
    });

    it('should reject profile with empty emails array', async () => {
      const profile = makeProfile({ emails: [] });

      const verify = await getVerifyCallback();
      const done = vi.fn();
      await verify('access-token', 'refresh-token', profile, done);

      expect(done).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should pass database errors to done callback', async () => {
      const dbError = new Error('DB connection failed');
      mockDbSelectFromWhereLimit.mockRejectedValueOnce(dbError);

      const verify = await getVerifyCallback();
      const done = vi.fn();
      await verify('access-token', 'refresh-token', makeProfile(), done);

      expect(done).toHaveBeenCalledWith(dbError);
    });
  });

  describe('OAuth Configuration', () => {
    it('should register strategy when env vars are set', async () => {
      const mod = await import('../../../../server/auth/strategies/google');
      expect(mod.isOAuthAvailable).toBe(true);

      const strategy = (mod.default as any)._strategy('google');
      expect(strategy).toBeDefined();
    });

    it('should not register strategy when env vars are missing', async () => {
      vi.resetModules();
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const mod = await import('../../../../server/auth/strategies/google');
      expect(mod.isOAuthAvailable).toBeFalsy();
    });
  });
});
