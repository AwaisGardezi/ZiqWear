import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { jsonField } from '../../utils/json';
import { AuthenticatedRequest, adminAuthMiddleware, requirePermission } from '../../middleware/auth';

export const adminUserRoutes = Router();
adminUserRoutes.use(adminAuthMiddleware);

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['SUPER_ADMIN', 'STORE_MANAGER', 'ORDER_MANAGER', 'INVENTORY_MANAGER', 'CONTENT_MANAGER', 'CUSTOMER_SUPPORT']),
  permissions: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

const createUserSchema = userSchema.extend({ password: z.string().min(8).max(128) });

adminUserRoutes.get('/', requirePermission('users:read'), async (_req: AuthenticatedRequest, res) => {
  const users = await prisma.adminUser.findMany({
    select: { id: true, email: true, name: true, role: true, permissions: true, isActive: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ users });
});

adminUserRoutes.post('/', requirePermission('users:create'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = createUserSchema.parse(req.body);
  
  const existing = await prisma.adminUser.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) throw new AppError('Email already exists', 409, 'EMAIL_EXISTS');
  
  const { password, ...userData } = data;
  const passwordHash = await bcrypt.hash(password, 12);
  
  const user = await prisma.adminUser.create({
    data: { ...userData, email: data.email.toLowerCase(), passwordHash, permissions: jsonField(data.permissions) },
  });
  
  await prisma.adminActivityLog.create({ data: { adminId, action: 'USER_CREATE', entityType: 'AdminUser', entityId: user.id, newData: JSON.stringify({ email: user.email, name: user.name, role: user.role }) } });
  
  res.status(201).json({ message: 'User created', user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

adminUserRoutes.patch('/:id', requirePermission('users:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = userSchema.partial().parse(req.body);
  
  const user = await prisma.adminUser.findUnique({ where: { id: req.params.id } });
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  
  if (data.email && data.email !== user.email) {
    const existing = await prisma.adminUser.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existing) throw new AppError('Email already exists', 409, 'EMAIL_EXISTS');
  }
  
  const updated = await prisma.adminUser.update({
    where: { id: req.params.id },
    data: { ...data, email: data.email?.toLowerCase(), permissions: data.permissions ? jsonField(data.permissions) : undefined },
  });
  
  await prisma.adminActivityLog.create({ data: { adminId, action: 'USER_UPDATE', entityType: 'AdminUser', entityId: updated.id, newData: JSON.stringify(data) } });
  
  res.json({ message: 'User updated', user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role } });
});

adminUserRoutes.delete('/:id', requirePermission('users:delete'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  if (req.params.id === adminId) throw new AppError('Cannot delete yourself', 400, 'SELF_DELETE');
  
  await prisma.adminUser.delete({ where: { id: req.params.id } });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'USER_DELETE', entityType: 'AdminUser', entityId: req.params.id } });
  res.json({ message: 'User deleted' });
});

adminUserRoutes.post('/:id/reset-password', requirePermission('users:update'), async (req: AuthenticatedRequest, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) throw new AppError('Password must be at least 8 characters', 400, 'INVALID_PASSWORD');
  
  const passwordHash = await bcrypt.hash(password, 12);
  
  await prisma.adminUser.update({ where: { id: req.params.id }, data: { passwordHash } });
  await prisma.adminActivityLog.create({ data: { adminId: req.user!.id, action: 'USER_PASSWORD_RESET', entityType: 'AdminUser', entityId: req.params.id } });
  
  res.json({ message: 'Password reset successfully' });
});