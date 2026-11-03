import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { AuthenticatedRequest, adminAuthMiddleware, requirePermission } from '../../middleware/auth';

export const adminAnalyticsRoutes = Router();
adminAnalyticsRoutes.use(adminAuthMiddleware);

const querySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  groupBy: z.enum(['day', 'month', 'year']).default('day'),
});

adminAnalyticsRoutes.get('/overview', requirePermission('analytics:read'), async (req: AuthenticatedRequest, res) => {
  const q = querySchema.parse(req.query);
  const dateFrom = q.dateFrom ? new Date(q.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateTo = q.dateTo ? new Date(q.dateTo) : new Date();
  
  const [totalRevenue, totalOrders, totalCustomers, totalProducts, avgOrderValue, pendingOrders, lowStock, outOfStock] = await Promise.all([
    prisma.order.aggregate({ where: { status: { notIn: ['CANCELLED', 'REFUNDED'] }, createdAt: { gte: dateFrom, lte: dateTo } }, _sum: { total: true } }),
    prisma.order.count({ where: { createdAt: { gte: dateFrom, lte: dateTo } } }),
    prisma.customer.count({ where: { createdAt: { gte: dateFrom, lte: dateTo } } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.aggregate({ where: { status: { notIn: ['CANCELLED', 'REFUNDED'] }, createdAt: { gte: dateFrom, lte: dateTo } }, _avg: { total: true } }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.inventory.count({ where: { quantity: { lte: 5, gt: 0 } } }),
    prisma.inventory.count({ where: { quantity: { lte: 0 } } }),
  ]);
  
  res.json({
    overview: {
      totalRevenue: Number(totalRevenue._sum.total || 0),
      totalOrders,
      totalCustomers,
      totalProducts,
      avgOrderValue: Number(avgOrderValue._avg.total || 0),
      pendingOrders,
      lowStockProducts: lowStock,
      outOfStockProducts: outOfStock,
    },
  });
});

adminAnalyticsRoutes.get('/revenue', requirePermission('analytics:read'), async (req: AuthenticatedRequest, res) => {
  const q = querySchema.parse(req.query);
  const dateFrom = q.dateFrom ? new Date(q.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateTo = q.dateTo ? new Date(q.dateTo) : new Date();
  
  // Get daily revenue for the period
  const orders = await prisma.order.findMany({
    where: { status: { notIn: ['CANCELLED', 'REFUNDED'] }, createdAt: { gte: dateFrom, lte: dateTo } },
    select: { total: true, createdAt: true },
  });
  
  // Group by day
  const revenueByDay: Record<string, number> = {};
  orders.forEach(o => {
    const day = o.createdAt.toISOString().split('T')[0];
    revenueByDay[day] = (revenueByDay[day] || 0) + Number(o.total);
  });
  
  res.json({ revenueByDay });
});

adminAnalyticsRoutes.get('/top-products', requirePermission('analytics:read'), async (req: AuthenticatedRequest, res) => {
  const q = querySchema.parse(req.query);
  const dateFrom = q.dateFrom ? new Date(q.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateTo = q.dateTo ? new Date(q.dateTo) : new Date();
  
  const topProducts = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: { order: { status: { notIn: ['CANCELLED', 'REFUNDED'] }, createdAt: { gte: dateFrom, lte: dateTo } } },
    _sum: { quantity: true, totalPrice: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 10,
  });
  
  const productIds = topProducts.map(p => p.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } }, include: { images: { where: { isPrimary: true }, take: 1 } } });
  
  const result = topProducts.map(tp => ({
    ...tp,
    product: products.find(p => p.id === tp.productId),
  }));
  
  res.json({ topProducts: result });
});

adminAnalyticsRoutes.get('/customers', requirePermission('analytics:read'), async (req: AuthenticatedRequest, res) => {
  const q = querySchema.parse(req.query);
  const dateFrom = q.dateFrom ? new Date(q.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateTo = q.dateTo ? new Date(q.dateTo) : new Date();
  
  const newCustomers = await prisma.customer.count({ where: { createdAt: { gte: dateFrom, lte: dateTo } } });
  const returningCustomers = await prisma.customer.count({ where: { totalOrders: { gt: 1 }, lastOrderAt: { gte: dateFrom, lte: dateTo } } });
  
  res.json({ newCustomers, returningCustomers });
});