import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { AppError } from '../../utils/AppError';
import { AuthenticatedRequest, adminAuthMiddleware } from '../../middleware/auth';

export const adminAuthRoutes = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  rememberMe: z.boolean().default(false),
  twoFactorCode: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(128),
});

// Admin login
adminAuthRoutes.post('/login', async (req: AuthenticatedRequest, res) => {
  const data = loginSchema.parse(req.body);
  
  const admin = await prisma.adminUser.findUnique({ where: { email: data.email.toLowerCase() } });
  
  if (!admin || !admin.isActive) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }
  
  const isValid = await bcrypt.compare(data.password, admin.passwordHash);
  
  if (!isValid) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }
  
  // TODO: Check 2FA if enabled
  
  // Update last login
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });
  
  // Create session
  const accessToken = jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role, permissions: admin.permissions, type: 'admin' },
    config.jwt.secret,
    { expiresIn: (data.rememberMe ? '30d' : config.jwt.adminTokenExpiry) as jwt.SignOptions['expiresIn'] }
  );
  
  // Store session
  await prisma.adminActivityLog.create({
    data: { adminId: admin.id, action: 'LOGIN', entityType: 'AdminUser', entityId: admin.id },
  });
  
  res.cookie('adminToken', accessToken, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    maxAge: data.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000,
  });
  
  res.json({
    message: 'Login successful',
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role, permissions: admin.permissions },
  });
});

// Admin logout
adminAuthRoutes.post('/logout', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  res.clearCookie('adminToken', { httpOnly: true, secure: config.cookie.secure, sameSite: config.cookie.sameSite });
  
  if (req.user) {
    await prisma.adminActivityLog.create({
      data: { adminId: req.user.id, action: 'LOGOUT', entityType: 'AdminUser', entityId: req.user.id },
    });
  }
  
  res.json({ message: 'Logged out successfully' });
});

// Get current admin
adminAuthRoutes.get('/me', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) throw new AppError('Not authenticated', 401, 'UNAUTHENTICATED');
  
  const admin = await prisma.adminUser.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, name: true, role: true, permissions: true, lastLoginAt: true, createdAt: true },
  });
  
  res.json({ admin });
});

// Change password
adminAuthRoutes.post('/change-password', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) throw new AppError('Not authenticated', 401, 'UNAUTHENTICATED');
  
  const data = changePasswordSchema.parse(req.body);
  
  const admin = await prisma.adminUser.findUnique({ where: { id: req.user.id } });
  if (!admin) throw new AppError('Admin not found', 404, 'NOT_FOUND');
  
  const isValid = await bcrypt.compare(data.currentPassword, admin.passwordHash);
  if (!isValid) throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');
  
  const newPasswordHash = await bcrypt.hash(data.newPassword, config.bcryptRounds);
  
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash: newPasswordHash },
  });
  
  await prisma.adminActivityLog.create({
    data: { adminId: admin.id, action: 'PASSWORD_CHANGE', entityType: 'AdminUser', entityId: admin.id },
  });
  
  res.json({ message: 'Password changed successfully' });
});