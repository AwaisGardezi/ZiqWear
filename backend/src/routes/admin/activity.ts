import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { AuthenticatedRequest, adminAuthMiddleware, requirePermission } from '../../middleware/auth';

export const adminActivityRoutes = Router();
adminActivityRoutes.use(adminAuthMiddleware);

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  adminId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

adminActivityRoutes.get('/', requirePermission('activity:read'), async (req: AuthenticatedRequest, res) => {
  const q = querySchema.parse(req.query);
  const where: any = {};
  if (q.adminId) where.adminId = q.adminId;
  if (q.action) where.action = q.action;
  if (q.entityType) where.entityType = q.entityType;
  if (q.dateFrom || q.dateTo) {
    where.createdAt = {};
    if (q.dateFrom) where.createdAt.gte = new Date(q.dateFrom);
    if (q.dateTo) where.createdAt.lte = new Date(q.dateTo);
  }
  
  const [logs, total] = await Promise.all([
    prisma.adminActivityLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit, include: { admin: { select: { id: true, name: true, email: true } } } }),
    prisma.adminActivityLog.count({ where }),
  ]);
  res.json({ logs, pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } });
});