import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { AuthenticatedRequest, adminAuthMiddleware, requirePermission } from '../../middleware/auth';

export const adminLoyaltyRoutes = Router();
adminLoyaltyRoutes.use(adminAuthMiddleware);

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  tier: z.enum(['SILVER', 'GOLD', 'BLACK']).optional(),
  search: z.string().optional(),
});

adminLoyaltyRoutes.get('/accounts', requirePermission('loyalty:read'), async (req: AuthenticatedRequest, res) => {
  const q = querySchema.parse(req.query);
  const where: any = {};
  if (q.tier) where.tier = q.tier;
  if (q.search) where.OR = [{ customer: { email: { contains: q.search } } }, { customer: { firstName: { contains: q.search } } }, { customer: { lastName: { contains: q.search } } }];
  
  const [accounts, total] = await Promise.all([
    prisma.loyaltyAccount.findMany({ where, include: { customer: { select: { id: true, email: true, firstName: true, lastName: true } } }, orderBy: { pointsBalance: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
    prisma.loyaltyAccount.count({ where }),
  ]);
  res.json({ accounts, pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } });
});

adminLoyaltyRoutes.get('/tiers', requirePermission('loyalty:read'), async (_req: AuthenticatedRequest, res) => {
  const tiers = await prisma.loyaltyAccount.groupBy({ by: ['tier'], _count: true, _avg: { pointsBalance: true } });
  res.json({ tiers });
});

const adjustSchema = z.object({
  customerId: z.string(),
  points: z.number().int(),
  reason: z.string(),
});

adminLoyaltyRoutes.post('/adjust', requirePermission('loyalty:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = adjustSchema.parse(req.body);
  
  const account = await prisma.loyaltyAccount.findUnique({ where: { customerId: data.customerId } });
  if (!account) throw new AppError('Loyalty account not found', 404, 'NOT_FOUND');
  
  const newBalance = Math.max(0, account.pointsBalance + data.points);
  
  await prisma.$transaction(async (tx) => {
    await tx.loyaltyAccount.update({ where: { id: account.id }, data: { pointsBalance: newBalance, lifetimePoints: { increment: data.points > 0 ? data.points : 0 }, totalRedeemed: { increment: data.points < 0 ? -data.points : 0 }, lastActivityAt: new Date() } });
    await tx.loyaltyTransaction.create({ data: { accountId: account.id, type: 'ADMIN_ADJUSTMENT', points: data.points, balance: newBalance, description: data.reason, referenceType: 'ADMIN', referenceId: adminId } });
    await tx.adminActivityLog.create({ data: { adminId, action: 'LOYALTY_ADJUST', entityType: 'LoyaltyAccount', entityId: account.id, newData: JSON.stringify(data) } });
  });
  
  res.json({ message: 'Points adjusted', newBalance });
});

adminLoyaltyRoutes.get('/transactions', requirePermission('loyalty:read'), async (req: AuthenticatedRequest, res) => {
  const q = querySchema.parse(req.query);
  const where: any = {};
  if (q.search) where.description = { contains: q.search };
  
  const [transactions, total] = await Promise.all([
    prisma.loyaltyTransaction.findMany({ where, include: { account: { include: { customer: { select: { email: true, firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
    prisma.loyaltyTransaction.count({ where }),
  ]);
  res.json({ transactions, pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } });
});