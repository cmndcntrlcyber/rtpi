import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';

const mockDbSelectFromWhereLimit = vi.fn();
const mockDbSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: mockDbSelectFromWhereLimit,
    }),
  }),
});

vi.mock('../../../../server/db', () => ({
  db: {
    select: (...args: any[]) => mockDbSelect(...args),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
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

vi.mock('../../../../server/lib/metrics', () => ({
  auditEventsTotal: { inc: vi.fn() },
}));

function mockReq(overrides: Record<string, any> = {}): Partial<Request> {
  return {
    isAuthenticated: () => true,
    user: { id: 'user-1', role: 'operator' },
    params: { id: 'resource-1' },
    ...overrides,
  };
}

function mockRes(): Partial<Response> {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('ensureResourceOwnership', () => {
  let ensureResourceOwnership: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: mockDbSelectFromWhereLimit,
        }),
      }),
    });

    const mod = await import('../../../../server/auth/middleware');
    ensureResourceOwnership = mod.ensureResourceOwnership;
  });

  const fakeTable = { id: 'id-col' };
  const fakeOwnerField = 'owner-col';

  it('should allow admin to bypass ownership check', async () => {
    const req = mockReq({ user: { id: 'admin-1', role: 'admin' } });
    const res = mockRes();
    const next = vi.fn();

    const middleware = ensureResourceOwnership(fakeTable, fakeOwnerField);
    await middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('should allow resource owner to proceed', async () => {
    mockDbSelectFromWhereLimit.mockResolvedValueOnce([{ ownerId: 'user-1' }]);

    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    const middleware = ensureResourceOwnership(fakeTable, fakeOwnerField);
    await middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
  });

  it('should reject non-owner with 403', async () => {
    mockDbSelectFromWhereLimit.mockResolvedValueOnce([{ ownerId: 'other-user' }]);

    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    const middleware = ensureResourceOwnership(fakeTable, fakeOwnerField);
    await middleware(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Forbidden' })
    );
  });

  it('should return 404 when resource is not found', async () => {
    mockDbSelectFromWhereLimit.mockResolvedValueOnce([]);

    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    const middleware = ensureResourceOwnership(fakeTable, fakeOwnerField);
    await middleware(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 401 when user is not authenticated', async () => {
    const req = mockReq({ isAuthenticated: () => false });
    const res = mockRes();
    const next = vi.fn();

    const middleware = ensureResourceOwnership(fakeTable, fakeOwnerField);
    await middleware(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 500 on database error', async () => {
    mockDbSelectFromWhereLimit.mockRejectedValueOnce(new Error('DB error'));

    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    const middleware = ensureResourceOwnership(fakeTable, fakeOwnerField);
    await middleware(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('should use custom idParam when specified', async () => {
    mockDbSelectFromWhereLimit.mockResolvedValueOnce([{ ownerId: 'user-1' }]);

    const req = mockReq({ params: { operationId: 'op-1' } });
    const res = mockRes();
    const next = vi.fn();

    const middleware = ensureResourceOwnership(fakeTable, fakeOwnerField, 'operationId');
    await middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
  });
});
