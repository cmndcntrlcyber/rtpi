import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const MANAGER_SRC = path.resolve(
  __dirname,
  '../../../server/services/agent-websocket-manager.ts'
);

describe('AgentWebSocketManager — session authentication', () => {
  describe('source-level guards', () => {
    const src = readFileSync(MANAGER_SRC, 'utf-8');

    it('no longer uses userId from query params', () => {
      expect(src).not.toMatch(/searchParams\.get\(["']userId["']\)/);
    });

    it('no longer falls back to "anonymous"', () => {
      expect(src).not.toMatch(/\|\|\s*["']anonymous["']/);
    });

    it('imports cookie parsing dependencies', () => {
      expect(src).toMatch(/require\(["']cookie["']\)/);
      expect(src).toMatch(/require\(["']cookie-signature["']\)/);
    });

    it('imports redisClient and sessionSecret from auth/session', () => {
      expect(src).toMatch(/import\s*{[^}]*redisClient[^}]*}\s*from\s*['"]\.\.\/auth\/session['"]/);
      expect(src).toMatch(/import\s*{[^}]*sessionSecret[^}]*}\s*from\s*['"]\.\.\/auth\/session['"]/);
    });

    it('has authenticateRequest method', () => {
      expect(src).toMatch(/async\s+authenticateRequest\s*\(/);
    });

    it('parses rtpi.sid cookie', () => {
      expect(src).toMatch(/["']rtpi\.sid["']/);
    });

    it('looks up session in Redis with sess: prefix', () => {
      expect(src).toMatch(/sess:\$\{sessionId\}/);
    });

    it('extracts passport.user from session data', () => {
      expect(src).toMatch(/passport/);
      expect(src).toMatch(/\.user/);
    });

    it('rejects unauthenticated connections with close code 1008', () => {
      expect(src).toMatch(/ws\.close\(1008/);
    });

    it('removed the TODO comment', () => {
      expect(src).not.toMatch(/TODO:\s*proper session auth/);
    });
  });
});
