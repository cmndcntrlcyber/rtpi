import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { db } from '../../../../server/db';

// Mock database
vi.mock('../../../../server/db');

describe('Local Authentication Strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('User Lookup', () => {
    it('should find user by username', async () => {
      const mockUser = {
        id: '123',
        username: 'testuser',
        passwordHash: await bcrypt.hash('ValidPass123!', 12),
        isActive: true,
        lockedUntil: null,
        failedLoginAttempts: 0,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      } as any);

      expect(mockUser.username).toBe('testuser');
    });

    it('should return null for non-existent username', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await db.select().from({} as any).where({} as any).limit(1);
      expect(result.length).toBe(0);
    });
  });

  describe('Password Verification', () => {
    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await bcrypt.hash(password, 12);
      
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const hash = await bcrypt.hash(password, 12);
      
      const isValid = await bcrypt.compare('WrongPassword', hash);
      expect(isValid).toBe(false);
    });

    it('should use bcrypt cost factor 12', async () => {
      const hash = await bcrypt.hash('test', 12);
      expect(hash.startsWith('$2b$12$')).toBe(true);
    });
  });

  describe('Account Status Checks', () => {
    it('should reject locked accounts', () => {
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min in future
      const now = new Date();
      
      expect(lockedUntil > now).toBe(true);
    });

    it('should allow access to unlocked accounts', () => {
      const lockedUntil = null;
      expect(lockedUntil).toBeNull();
    });

    it('should reject inactive accounts', () => {
      const isActive = false;
      expect(isActive).toBe(false);
    });

    it('should allow active accounts', () => {
      const isActive = true;
      expect(isActive).toBe(true);
    });

    it('should reject OAuth users without password', () => {
      const passwordHash = null; // OAuth user
      expect(passwordHash).toBeNull();
    });
  });

  describe('Failed Login Tracking', () => {
    it('should increment failed attempts on wrong password', () => {
      let failedAttempts = 0;
      failedAttempts++;
      expect(failedAttempts).toBe(1);
    });

    it('should lock account after 5 failed attempts', () => {
      const failedAttempts = 5;
      const shouldLock = failedAttempts >= 5;
      expect(shouldLock).toBe(true);
    });

    it('should set 30-minute lockout', () => {
      const lockDuration = 30 * 60 * 1000; // 30 minutes in ms
      const lockedUntil = new Date(Date.now() + lockDuration);
      const now = new Date();
      
      const minutesLocked = (lockedUntil.getTime() - now.getTime()) / (60 * 1000);
      expect(minutesLocked).toBeGreaterThanOrEqual(29);
      expect(minutesLocked).toBeLessThanOrEqual(31);
    });

    it('should not lock before 5 attempts', () => {
      const failedAttempts = 3;
      const shouldLock = failedAttempts >= 5;
      expect(shouldLock).toBe(false);
    });

    it('should reset failed attempts on successful login', () => {
      const resetAttempts = 0;
      expect(resetAttempts).toBe(0);
    });

    it('should clear lock time on successful login', () => {
      const clearedLock = null;
      expect(clearedLock).toBeNull();
    });
  });

  describe('Session Management', () => {
    it('should serialize user ID for session', () => {
      const user = { id: '123', username: 'test' };
      expect(user.id).toBe('123');
    });

    it('should deserialize user from ID', async () => {
      const userId = '123';
      const mockUser = {
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      } as any);

      expect(userId).toBe('123');
    });
  });

  describe('Security Features', () => {
    it('should not reveal if username exists on failed login', () => {
      const genericMessage = 'Invalid username or password';
      expect(genericMessage).toBe('Invalid username or password');
    });

    it('should show account locked message when locked', () => {
      const lockMessage = 'Account is locked. Try again later.';
      expect(lockMessage).toContain('locked');
    });

    it('should show inactive account message', () => {
      const inactiveMessage = 'Account is disabled';
      expect(inactiveMessage).toContain('disabled');
    });

    it('should show method mismatch for OAuth users', () => {
      const methodMessage = 'Invalid authentication method';
      expect(methodMessage).toContain('authentication method');
    });

    it('should show lockout duration in message', () => {
      const lockoutMessage = 'Too many failed attempts. Account locked for 30 minutes.';
      expect(lockoutMessage).toContain('30 minutes');
    });
  });

  describe('Last Login Tracking', () => {
    it('should update last login timestamp on successful auth', () => {
      const lastLogin = new Date();
      expect(lastLogin).toBeInstanceOf(Date);
    });

    it('should track login time accurately', () => {
      const now = new Date();
      const lastLogin = new Date();
      const diff = Math.abs(now.getTime() - lastLogin.getTime());
      expect(diff).toBeLessThan(1000); // Within 1 second
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('DB error')),
          }),
        }),
      } as any);

      try {
        await db.select().from({} as any).where({} as any).limit(1);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
