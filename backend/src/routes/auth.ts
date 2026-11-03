import { Router, Request } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

export const authRoutes = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().min(7).max(20).optional().or(z.literal('')),
  marketingOptIn: z.boolean().optional().default(false),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

function publicCustomer(customer: any) {
  if (!customer) return null;
  const { passwordHash, resetToken, resetTokenExpiresAt, verificationToken, ...rest } = customer;
  return rest;
}

/**
 * Turn a JWT expiry string ("15m", "7d", "8h") into milliseconds so the
 * `CustomerSession.expiresAt` column matches the lifetime of the refresh token
 * that references it.
 */
function expiryToMs(expiry: string): number {
  const match = /^(\d+)([smhd])$/.exec(String(expiry).trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return value * unit;
}

function requestMeta(req?: Request) {
  return {
    ipAddress: req?.ip ?? req?.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() ?? null,
    userAgent: req?.headers?.['user-agent']?.slice(0, 500) ?? null,
  };
}

/** Best-effort decode of a customer JWT; an invalid/expired token is just "no session". */
function readCustomerToken(token?: string): { id: string; sid?: string } | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { id: string; sid?: string; type?: string };
    if (decoded.type && decoded.type !== 'customer') return null;
    return { id: decoded.id, sid: decoded.sid };
  } catch {
    return null;
  }
}

const readSessionToken = (token?: string): string | undefined => readCustomerToken(token)?.sid;
const readCustomerId = (token?: string): string | undefined => readCustomerToken(token)?.id;

/**
 * Issue a customer token pair and persist a `CustomerSession` row for it.
 *
 * The row is the server-side half of the session: `token` is a random session id
 * carried by the JWT as `sid`, so `/auth/logout` and `/auth/sessions` can end a
 * session for real instead of only clearing cookies on one browser. Refresh
 * rotates the row, which makes a replayed refresh token single-use.
 */
async function issueTokens(
  customerId: string,
  email: string,
  rememberMe = false,
  req?: Request
) {
  const sessionId = crypto.randomBytes(24).toString('hex');
  const refreshTtlMs = expiryToMs(config.jwt.refreshTokenExpiry);

  const accessToken = jwt.sign(
    { id: customerId, email, role: 'CUSTOMER', permissions: [], type: 'customer', sid: sessionId },
    config.jwt.secret,
    { expiresIn: config.jwt.accessTokenExpiry as jwt.SignOptions['expiresIn'] }
  );

  const refreshToken = jwt.sign(
    { id: customerId, email, role: 'CUSTOMER', permissions: [], type: 'customer', sid: sessionId },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshTokenExpiry as jwt.SignOptions['expiresIn'] }
  );

  await prisma.customerSession.create({
    data: {
      customerId,
      token: sessionId,
      expiresAt: new Date(Date.now() + refreshTtlMs),
      ...requestMeta(req),
    },
  });

  return {
    accessToken,
    refreshToken,
    sessionId,
    maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : config.cookie.maxAge,
    refreshTtlMs,
  };
}

function setAuthCookies(res: any, tokens: Awaited<ReturnType<typeof issueTokens>>) {
  const options = {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
  };
  res.cookie('accessToken', tokens.accessToken, { ...options, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', tokens.refreshToken, { ...options, maxAge: tokens.maxAge });
}

/**
 * Revoke one session (the `CustomerSession.token` column holds the session id
 * the JWT carries as `sid`).
 */
async function revokeSession(sessionToken: string) {
  await prisma.customerSession.deleteMany({ where: { token: sessionToken } });
}

/**
 * Revoke a customer's sessions, optionally keeping the current one — which is
 * what makes "sign out of this device", "sign out everywhere" and "the password
 * changed, so every other device must re-authenticate" real server-side actions
 * instead of cookie-deep-six.
 */
async function revokeSessions(customerId: string, exceptSessionToken?: string) {
  await prisma.customerSession.deleteMany({
    where: { customerId, ...(exceptSessionToken ? { token: { not: exceptSessionToken } } : {}) },
  });
}

// Register
authRoutes.post('/register', async (req, res) => {
  const data = registerSchema.parse(req.body);
  const email = data.email.toLowerCase();

  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) throw new AppError('An account with this email already exists', 409, 'EMAIL_EXISTS');

  const passwordHash = await bcrypt.hash(data.password, config.bcryptRounds);
  const verificationToken = crypto.randomBytes(24).toString('hex');

  const customer = await prisma.customer.create({
    data: {
      email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || null,
      marketingOptIn: data.marketingOptIn,
      verificationToken,
      loyaltyAccount: { create: { tier: 'SILVER', pointsBalance: 0 } },
    },
  });

  const tokens = await issueTokens(customer.id, customer.email, false, req);
  setAuthCookies(res, tokens);

  res.status(201).json({
    message: 'Account created',
    customer: publicCustomer(customer),
    // In local development email is often not configured, so expose the token.
    ...(config.nodeEnv !== 'production' ? { verificationToken } : {}),
  });
});

// Login
authRoutes.post('/login', async (req, res) => {
  const data = loginSchema.parse(req.body);
  const email = data.email.toLowerCase();

  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer || !customer.passwordHash) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  if (customer.isBlocked) {
    throw new AppError('This account has been blocked. Contact support.', 403, 'ACCOUNT_BLOCKED');
  }

  const valid = await bcrypt.compare(data.password, customer.passwordHash);
  if (!valid) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');

  const tokens = await issueTokens(customer.id, customer.email, data.rememberMe, req);
  setAuthCookies(res, tokens);

  res.json({ message: 'Logged in', customer: publicCustomer(customer) });
});

// Logout — revokes the current session server-side, then clears the cookies.
// `all=true` signs the customer out of every device.
authRoutes.post('/logout', async (req, res) => {
  const options = { httpOnly: true, secure: config.cookie.secure, sameSite: config.cookie.sameSite };

  const token = req.cookies?.accessToken || req.cookies?.refreshToken;
  const sessionToken = readSessionToken(token);
  const customerId = readCustomerId(token);

  if (sessionToken) await revokeSession(sessionToken);
  if (req.query.all === 'true' && customerId) await revokeSessions(customerId);

  res.clearCookie('accessToken', options);
  res.clearCookie('refreshToken', options);
  res.json({ message: 'Logged out', sessionsRevoked: sessionToken ? 1 : 0 });
});

// Current customer
authRoutes.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.customer) throw new AppError('Not authenticated', 401, 'UNAUTHENTICATED');

  const customer = await prisma.customer.findUnique({
    where: { id: req.customer.id },
    include: {
      loyaltyAccount: true,
      addresses: true,
      _count: { select: { orders: true, wishlist: true, reviews: true } },
    },
  });

  if (!customer) throw new AppError('Customer not found', 404, 'NOT_FOUND');
  res.json({ customer: publicCustomer(customer) });
});

// Refresh session.
//
// The refresh token's `sid` must still exist in `CustomerSession`: rotating it
// deletes the old row, so a replayed (e.g. stolen) refresh token fails instead of
// minting a second live session.
authRoutes.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) throw new AppError('No refresh token', 401, 'NO_REFRESH_TOKEN');

  let decoded: { id: string; email: string; sid?: string };
  try {
    decoded = jwt.verify(refreshToken, config.jwt.secret) as { id: string; email: string; sid?: string };
  } catch {
    throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
  }

  if (!decoded.sid) throw new AppError('Session has no server-side record', 401, 'NO_SESSION');

  const session = await prisma.customerSession.findUnique({ where: { token: decoded.sid } });
  if (!session || session.expiresAt < new Date()) {
    throw new AppError('Session expired or signed out, sign in again', 401, 'SESSION_REVOKED');
  }

  const customer = await prisma.customer.findUnique({
    where: { id: decoded.id },
    select: { id: true, email: true, isBlocked: true },
  });
  if (!customer) throw new AppError('Customer not found', 401, 'CUSTOMER_NOT_FOUND');
  if (customer.isBlocked) throw new AppError('This account has been blocked', 403, 'ACCOUNT_BLOCKED');

  const tokens = await issueTokens(customer.id, customer.email, true, req);
  await revokeSession(decoded.sid);
  setAuthCookies(res, tokens);

  res.json({ message: 'Session refreshed' });
});

// Active sessions for the signed-in customer (device list in "my account").
authRoutes.get('/sessions', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const sessions = await prisma.customerSession.findMany({
    where: { customerId: req.customer!.id, expiresAt: { gt: new Date() } },
    select: { id: true, ipAddress: true, userAgent: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ sessions });
});

// Sign out of every device by dropping all server-side sessions.
authRoutes.delete('/sessions', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { count } = await prisma.customerSession.deleteMany({ where: { customerId: req.customer!.id } });
  const options = { httpOnly: true, secure: config.cookie.secure, sameSite: config.cookie.sameSite };
  res.clearCookie('accessToken', options);
  res.clearCookie('refreshToken', options);
  res.json({ message: 'Signed out of all devices', sessionsRevoked: count });
});

// Forgot password
authRoutes.post('/forgot-password', async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const customer = await prisma.customer.findUnique({ where: { email: email.toLowerCase() } });

  if (!customer) {
    // Do not reveal whether the account exists.
    res.json({ message: 'If an account exists, a reset link has been sent' });
    return;
  }

  const resetToken = crypto.randomBytes(24).toString('hex');
  await prisma.customer.update({
    where: { id: customer.id },
    data: { resetToken, resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });

  res.json({
    message: 'If an account exists, a reset link has been sent',
    ...(config.nodeEnv !== 'production' ? { resetToken } : {}),
  });
});

// Reset password
authRoutes.post('/reset-password', async (req, res) => {
  const { token, password } = z
    .object({ token: z.string().min(10), password: z.string().min(8).max(128) })
    .parse(req.body);

  const customer = await prisma.customer.findFirst({ where: { resetToken: token } });
  if (!customer || !customer.resetTokenExpiresAt || customer.resetTokenExpiresAt < new Date()) {
    throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  await prisma.customer.update({
    where: { id: customer.id },
    data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
  });

  // A password reset invalidates every existing session: the tokens alone are no
  // longer enough once the account may have been compromised.
  await revokeSessions(customer.id);

  res.json({ message: 'Password updated. You can now sign in.' });
});

// Verify email
authRoutes.post('/verify-email', async (req, res) => {
  const { token } = z.object({ token: z.string().min(10) }).parse(req.body);

  const customer = await prisma.customer.findFirst({ where: { verificationToken: token } });
  if (!customer) throw new AppError('Invalid verification token', 400, 'INVALID_TOKEN');

  await prisma.customer.update({
    where: { id: customer.id },
    data: { isVerified: true, emailVerifiedAt: new Date(), verificationToken: null },
  });

  res.json({ message: 'Email verified' });
});

// Resend verification
authRoutes.post('/resend-verification', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.customer) throw new AppError('Not authenticated', 401, 'UNAUTHENTICATED');

  const verificationToken = crypto.randomBytes(24).toString('hex');
  await prisma.customer.update({
    where: { id: req.customer.id },
    data: { verificationToken },
  });

  res.json({
    message: 'Verification email sent',
    ...(config.nodeEnv !== 'production' ? { verificationToken } : {}),
  });
});
