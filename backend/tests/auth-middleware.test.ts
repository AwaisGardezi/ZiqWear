import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

/**
 * Unit tests for the JWT auth middleware.
 *
 * Prisma is mocked wholesale: importing src/lib/prisma.ts would construct a
 * real PrismaClient, and these tests must never reach the database. The mock is
 * declared with the same specifier the middleware uses (resolved to
 * src/lib/prisma.ts) so vi.mock intercepts it.
 *
 * config is the real module, so the tests sign tokens with whatever
 * config.jwt.secret resolves to and never hardcode a secret.
 */
vi.mock('../src/lib/prisma', () => ({
  prisma: {
    adminUser: { findUnique: vi.fn() },
    customer: { findUnique: vi.fn() },
  },
}));

import { config } from '../src/config';
import { prisma } from '../src/lib/prisma';
import { AppError } from '../src/utils/AppError';
import {
  authMiddleware,
  adminAuthMiddleware,
  optionalAuth,
  requirePermission,
  requireRole,
} from '../src/middleware/auth';

type MockReq = { cookies: Record<string, string | undefined>; headers: Record<string, string> };

const adminUser = {
  id: 'admin-1',
  email: 'ops@ziqwear.test',
  role: 'ADMIN',
  permissions: ['orders.read', 'products.write'],
  isActive: true,
};

const customer = {
  id: 'cust-1',
  email: 'shopper@ziqwear.test',
  phone: '03330000000',
  isVerified: true,
};

function sign(payload: Record<string, unknown>, options: jwt.SignOptions = {}) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: '15m', ...options });
}

function makeReq(cookies: Record<string, string | undefined> = {}, authorization?: string): MockReq {
  return {
    cookies,
    headers: authorization ? { authorization } : {},
  };
}

/** Runs a middleware and returns the next() spy plus any error it was given. */
async function run(
  middleware: (req: any, res: any, next: any) => Promise<void> | void,
  req: MockReq,
) {
  const next = vi.fn();
  await middleware(req, {} as never, next);
  return { next, error: next.mock.calls[0]?.[0], called: next.mock.calls.length };
}

function expectAppError(error: unknown, statusCode: number, code: string) {
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).statusCode).toBe(statusCode);
  expect((error as AppError).code).toBe(code);
}

beforeEach(() => {
  vi.mocked(prisma.adminUser.findUnique).mockReset();
  vi.mocked(prisma.customer.findUnique).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('authMiddleware', () => {
  it('rejects a request with no token', async () => {
    const { next, error } = await run(authMiddleware, makeReq());

    expect(next).toHaveBeenCalledTimes(1);
    expectAppError(error, 401, 'UNAUTHENTICATED');
  });

  it('accepts a customer token from a cookie and attaches req.customer', async () => {
    vi.mocked(prisma.customer.findUnique).mockResolvedValue(customer as never);
    const req = makeReq({ accessToken: sign({ id: 'cust-1', type: 'customer' }) });

    const { next, error } = await run(authMiddleware, req as never);

    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
    expect(req).toMatchObject({
      customer: { id: 'cust-1', email: 'shopper@ziqwear.test', phone: '03330000000' },
    });
    expect(prisma.customer.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.adminUser.findUnique).not.toHaveBeenCalled();
  });

  it('accepts a Bearer token from the Authorization header when no cookie is set', async () => {
    vi.mocked(prisma.customer.findUnique).mockResolvedValue(customer as never);
    const token = sign({ id: 'cust-1', type: 'customer' });
    const req = makeReq({}, `Bearer ${token}`);

    const { next, error } = await run(authMiddleware, req as never);

    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
    expect(req.customer?.id).toBe('cust-1');
  });

  it('looks the subject up by the token id, never by email', async () => {
    vi.mocked(prisma.customer.findUnique).mockResolvedValue(customer as never);
    await run(
      authMiddleware,
      makeReq({ accessToken: sign({ id: 'cust-9', email: 'whoever@ziqwear.test', type: 'customer' }) }) as never,
    );

    expect(prisma.customer.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cust-9' } }),
    );
  });

  it('rejects a customer token whose subject no longer exists', async () => {
    vi.mocked(prisma.customer.findUnique).mockResolvedValue(null);
    const { error } = await run(
      authMiddleware,
      makeReq({ accessToken: sign({ id: 'ghost', type: 'customer' }) }) as never,
    );

    expectAppError(error, 401, 'CUSTOMER_NOT_FOUND');
  });

  it('attaches req.user for an active admin token', async () => {
    vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(adminUser as never);
    const req = makeReq({
      accessToken: sign({ id: 'admin-1', email: adminUser.email, role: 'ADMIN', permissions: adminUser.permissions, type: 'admin' }),
    });

    const { next, error } = await run(authMiddleware, req as never);

    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({
      id: 'admin-1',
      email: 'ops@ziqwear.test',
      role: 'ADMIN',
      permissions: ['orders.read', 'products.write'],
    });
  });

  it('rejects a deactivated admin even though the token is still valid', async () => {
    vi.mocked(prisma.adminUser.findUnique).mockResolvedValue({ ...adminUser, isActive: false } as never);
    const { error } = await run(
      authMiddleware,
      makeReq({ accessToken: sign({ id: 'admin-1', type: 'admin' }) }) as never,
    );

    expectAppError(error, 401, 'ADMIN_INACTIVE');
  });

  it('maps a forged signature to INVALID_TOKEN', async () => {
    const forged = jwt.sign({ id: 'admin-1', type: 'admin' }, 'not-the-real-secret');

    const { error } = await run(authMiddleware, makeReq({ accessToken: forged }) as never);

    expectAppError(error, 401, 'INVALID_TOKEN');
    expect((error as AppError).message).toBe('Invalid or expired token');
  });

  it('maps an expired token to INVALID_TOKEN as well', async () => {
    const expired = sign({ id: 'cust-1', type: 'customer' }, { expiresIn: '-30s' });

    const { error } = await run(authMiddleware, makeReq({ accessToken: expired }) as never);

    expectAppError(error, 401, 'INVALID_TOKEN');
  });

  it('does not swallow a database failure as an auth failure', async () => {
    const boom = new Error('sqlite is locked');
    vi.mocked(prisma.customer.findUnique).mockRejectedValue(boom);

    const { error } = await run(
      authMiddleware,
      makeReq({ accessToken: sign({ id: 'cust-1', type: 'customer' }) }) as never,
    );

    // A transient DB outage must not present as "invalid token" to the client.
    expect(error).toBe(boom);
  });

  it('omits phone when the customer has none', async () => {
    vi.mocked(prisma.customer.findUnique).mockResolvedValue({ ...customer, phone: null } as never);
    const req = makeReq({ accessToken: sign({ id: 'cust-1', type: 'customer' }) });

    await run(authMiddleware, req as never);

    expect(req.customer).toEqual({ id: 'cust-1', email: 'shopper@ziqwear.test', phone: undefined });
  });
});

describe('adminAuthMiddleware', () => {
  it('reads the adminToken cookie, not accessToken', async () => {
    // A customer accessToken must not satisfy the admin guard by accident.
    const { error } = await run(
      adminAuthMiddleware,
      makeReq({ accessToken: sign({ id: 'cust-1', type: 'customer' }) }) as never,
    );

    expectAppError(error, 401, 'UNAUTHENTICATED');
  });

  it('accepts a valid admin token from the adminToken cookie', async () => {
    vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(adminUser as never);
    const req = makeReq({ adminToken: sign({ id: 'admin-1', type: 'admin' }) });

    const { next, error } = await run(adminAuthMiddleware, req as never);

    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
    expect(req.user?.role).toBe('ADMIN');
  });

  it('rejects a customer-type token presented to the admin guard', async () => {
    const { error } = await run(
      adminAuthMiddleware,
      makeReq({ adminToken: sign({ id: 'cust-1', type: 'customer' }) }) as never,
    );

    expectAppError(error, 401, 'INVALID_TOKEN_TYPE');
    expect(prisma.adminUser.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an inactive admin', async () => {
    vi.mocked(prisma.adminUser.findUnique).mockResolvedValue({ ...adminUser, isActive: false } as never);

    const { error } = await run(
      adminAuthMiddleware,
      makeReq({ adminToken: sign({ id: 'admin-1', type: 'admin' }) }) as never,
    );

    expectAppError(error, 401, 'ADMIN_INACTIVE');
  });

  it('reports a bad signature with the admin-specific message', async () => {
    const forged = jwt.sign({ id: 'admin-1', type: 'admin' }, 'wrong-secret');

    const { error } = await run(adminAuthMiddleware, makeReq({ adminToken: forged }) as never);

    expectAppError(error, 401, 'INVALID_TOKEN');
    expect((error as AppError).message).toBe('Invalid or expired admin token');
  });
});

describe('optionalAuth', () => {
  it('passes through when there is no token at all', async () => {
    const req = makeReq();

    const { next, error } = await run(optionalAuth, req as never);

    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
    expect(req.customer).toBeUndefined();
  });

  it('swallows an invalid token instead of rejecting the request', async () => {
    const req = makeReq({ accessToken: 'this-is-not-a-jwt' });

    const { next, error } = await run(optionalAuth, req as never);

    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it('ignores an admin token (optional auth is for shoppers)', async () => {
    const req = makeReq({ accessToken: sign({ id: 'admin-1', type: 'admin' }) });

    const { next } = await run(optionalAuth, req as never);

    expect(next).toHaveBeenCalledWith();
    expect(req.customer).toBeUndefined();
    expect(prisma.customer.findUnique).not.toHaveBeenCalled();
  });

  it('attaches the customer when the token is valid', async () => {
    vi.mocked(prisma.customer.findUnique).mockResolvedValue(customer as never);
    const req = makeReq({ accessToken: sign({ id: 'cust-1', type: 'customer' }) });

    await run(optionalAuth, req as never);

    expect(req.customer?.id).toBe('cust-1');
  });

  it('still calls next() when the customer has been deleted', async () => {
    vi.mocked(prisma.customer.findUnique).mockResolvedValue(null);
    const req = makeReq({ accessToken: sign({ id: 'gone', type: 'customer' }) });

    const { next, error } = await run(optionalAuth, req as never);

    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
    expect(req.customer).toBeUndefined();
  });
});

describe('requirePermission', () => {
  const guard = requirePermission('orders.read');

  it('throws when the request was never authenticated', () => {
    const next = vi.fn();
    expect(() => guard({} as never, {} as never, next)).toThrowError(AppError);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes when the user holds one of the required permissions', () => {
    const next = vi.fn();
    guard({ user: adminUser } as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('passes on the "*" wildcard', () => {
    const next = vi.fn();
    requirePermission('anything')(
      { user: { ...adminUser, permissions: ['*'] } } as never,
      {} as never,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('lets SUPER_ADMIN through regardless of the permission list', () => {
    const next = vi.fn();
    requirePermission('dangerous:write')(
      { user: { ...adminUser, role: 'SUPER_ADMIN', permissions: [] } } as never,
      {} as never,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('throws 403 FORBIDDEN when the permission is missing', () => {
    const next = vi.fn();
    try {
      requirePermission('payments:refund')({ user: adminUser } as never, {} as never, next);
      expect.unreachable('requirePermission should have thrown');
    } catch (error) {
      expectAppError(error, 403, 'FORBIDDEN');
    }
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  it('accepts a listed role', () => {
    const next = vi.fn();
    requireRole('ADMIN', 'EDITOR')({ user: adminUser } as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects an unlisted role with 403', () => {
    const next = vi.fn();
    try {
      requireRole('SUPER_ADMIN')({ user: { ...adminUser, role: 'VIEWER' } } as never, {} as never, next);
      expect.unreachable('requireRole should have thrown');
    } catch (error) {
      expectAppError(error, 403, 'FORBIDDEN');
    }
  });

  it('always admits SUPER_ADMIN', () => {
    const next = vi.fn();
    requireRole('ADMIN_ONLY_ROLE')({ user: { ...adminUser, role: 'SUPER_ADMIN' } } as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('throws 401 when there is no user on the request', () => {
    expect(() => requireRole('ADMIN')({} as never, {} as never, vi.fn())).toThrowError(AppError);
  });
});
