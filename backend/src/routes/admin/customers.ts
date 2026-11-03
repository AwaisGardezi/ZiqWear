import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { logAdminActivity } from '../../utils/audit';
import { redactCustomer } from '../../utils/redact';
import { AuthenticatedRequest, adminAuthMiddleware, requirePermission } from '../../middleware/auth';

export const adminCustomerRoutes = Router();
adminCustomerRoutes.use(adminAuthMiddleware);

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  isVerified: z.coerce.boolean().optional(),
  hasOrders: z.coerce.boolean().optional(),
  sortBy: z.enum(['createdAt', 'totalSpent', 'totalOrders', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

adminCustomerRoutes.get('/', requirePermission('customers:read'), async (req: AuthenticatedRequest, res) => {
  const q = querySchema.parse(req.query);
  const where: any = {};
  if (q.search) where.OR = [{ email: { contains: q.search } }, { phone: { contains: q.search } }, { firstName: { contains: q.search } }, { lastName: { contains: q.search } }];
  if (q.isVerified !== undefined) where.isVerified = q.isVerified;
  if (q.hasOrders) where.totalOrders = { gt: 0 };
  
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: { [q.sortBy]: q.sortOrder }, skip: (q.page - 1) * q.limit, take: q.limit, include: { _count: { select: { orders: true, addresses: true, wishlist: true } }, loyaltyAccount: { select: { tier: true, pointsBalance: true } } } }),
    prisma.customer.count({ where }),
  ]);
  res.json({ customers, pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } });
});

adminCustomerRoutes.get('/:id', requirePermission('customers:read'), async (req: AuthenticatedRequest, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: { addresses: true, orders: { include: { items: true }, orderBy: { createdAt: 'desc' }, take: 10 }, loyaltyAccount: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } } }, wishlist: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } }, reviews: { include: { product: { select: { id: true, title: true } } } } },
  });
  if (!customer) throw new AppError('Customer not found', 404, 'NOT_FOUND');
  // passwordHash / reset + verification tokens never leave the API, even for admins.
  res.json({ customer: redactCustomer(customer) });
});

adminCustomerRoutes.patch('/:id', requirePermission('customers:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const { tags, notes, isBlocked } = req.body;
  
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: { tags, notes, isBlocked },
  });

  // Blocking an account is only effective if its live sessions die with it.
  if (isBlocked === true) {
    await prisma.customerSession.deleteMany({ where: { customerId: req.params.id } });
  }

  await logAdminActivity(
    prisma,
    { adminId, action: 'CUSTOMER_UPDATE', entityType: 'Customer', entityId: req.params.id, newData: { tags, notes, isBlocked } },
    req
  );
  
  res.json({ message: 'Customer updated', customer: redactCustomer(customer) });
});