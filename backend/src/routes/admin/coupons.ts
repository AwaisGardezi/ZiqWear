import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { jsonField } from '../../utils/json';
import { logAdminActivity } from '../../utils/audit';
import { AuthenticatedRequest, adminAuthMiddleware, requirePermission } from '../../middleware/auth';

export const adminCouponRoutes = Router();
adminCouponRoutes.use(adminAuthMiddleware);

const couponSchema = z.object({
  code: z.string().min(1).max(50).toUpperCase(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
  value: z.number().positive(),
  minPurchase: z.number().positive().optional(),
  maxDiscount: z.number().positive().optional(),
  usageLimit: z.number().int().positive().optional(),
  perCustomerLimit: z.number().int().positive().default(1),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
  appliesToAll: z.boolean().default(true),
  productIds: z.array(z.string()).default([]),
  collectionIds: z.array(z.string()).default([]),
  customerSegmentIds: z.array(z.string()).default([]),
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

adminCouponRoutes.get('/', requirePermission('coupons:read'), async (req: AuthenticatedRequest, res) => {
  const q = querySchema.parse(req.query);
  const where: any = {};
  if (q.search) where.OR = [{ code: { contains: q.search } }, { name: { contains: q.search } }];
  if (q.isActive !== undefined) where.isActive = q.isActive;
  
  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit, include: { _count: { select: { usages: true } } } }),
    prisma.coupon.count({ where }),
  ]);
  res.json({ coupons, pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } });
});

adminCouponRoutes.post('/', requirePermission('coupons:create'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = couponSchema.parse(req.body);
  
  const existing = await prisma.coupon.findUnique({ where: { code: data.code } });
  if (existing) throw new AppError('Coupon code already exists', 409, 'CODE_EXISTS');
  
  const coupon = await prisma.coupon.create({ data: { ...data, productIds: jsonField(data.productIds), collectionIds: jsonField(data.collectionIds), customerSegmentIds: jsonField(data.customerSegmentIds), startsAt: data.startsAt ? new Date(data.startsAt) : null, expiresAt: data.expiresAt ? new Date(data.expiresAt) : null, createdById: adminId, updatedById: adminId } });
  await logAdminActivity(prisma, { adminId, action: 'COUPON_CREATE', entityType: 'Coupon', entityId: coupon.id, newData: coupon }, req);
  res.status(201).json({ message: 'Coupon created', coupon });
});

adminCouponRoutes.patch('/:id', requirePermission('coupons:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = couponSchema.partial().parse(req.body);
  
  const coupon = await prisma.coupon.findUnique({ where: { id: req.params.id } });
  if (!coupon) throw new AppError('Coupon not found', 404, 'NOT_FOUND');
  
  if (data.code && data.code !== coupon.code) {
    const existing = await prisma.coupon.findUnique({ where: { code: data.code } });
    if (existing) throw new AppError('Coupon code already exists', 409, 'CODE_EXISTS');
  }
  
  const updated = await prisma.coupon.update({ where: { id: req.params.id }, data: { ...data, productIds: data.productIds ? jsonField(data.productIds) : undefined, collectionIds: data.collectionIds ? jsonField(data.collectionIds) : undefined, customerSegmentIds: data.customerSegmentIds ? jsonField(data.customerSegmentIds) : undefined, startsAt: data.startsAt ? new Date(data.startsAt) : undefined, expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined, updatedById: adminId } });
  await logAdminActivity(prisma, { adminId, action: 'COUPON_UPDATE', entityType: 'Coupon', entityId: updated.id, newData: data }, req);
  res.json({ message: 'Coupon updated', coupon: updated });
});

adminCouponRoutes.delete('/:id', requirePermission('coupons:delete'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  await prisma.coupon.delete({ where: { id: req.params.id } });
  await logAdminActivity(prisma, { adminId, action: 'COUPON_DELETE', entityType: 'Coupon', entityId: req.params.id }, req);
  res.json({ message: 'Coupon deleted' });
});