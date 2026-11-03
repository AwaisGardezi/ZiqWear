import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { logAdminActivity } from '../../utils/audit';
import { restoreOrderStock, isRestockingStatus, restockMovementTypeFor } from '../../services/inventory';
import { notifyOrderEvent } from '../../services/notifications';
import { AuthenticatedRequest, adminAuthMiddleware, requirePermission } from '../../middleware/auth';

export const adminOrderRoutes = Router();
adminOrderRoutes.use(adminAuthMiddleware);

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED']).optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']).optional(),
  search: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'total', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

adminOrderRoutes.get('/', requirePermission('orders:read'), async (req: AuthenticatedRequest, res) => {
  const q = querySchema.parse(req.query);
  const where: any = {};
  if (q.status) where.status = q.status;
  if (q.paymentStatus) where.paymentStatus = q.paymentStatus;
  if (q.search) where.OR = [{ orderNumber: { contains: q.search } }, { email: { contains: q.search } }, { phone: { contains: q.search } }];
  if (q.dateFrom || q.dateTo) {
    where.createdAt = {};
    if (q.dateFrom) where.createdAt.gte = new Date(q.dateFrom);
    if (q.dateTo) where.createdAt.lte = new Date(q.dateTo);
  }
  
  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { [q.sortBy]: q.sortOrder }, skip: (q.page - 1) * q.limit, take: q.limit, include: { customer: { select: { id: true, email: true, firstName: true, lastName: true } }, items: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } }, _count: { select: { items: true } } } }),
    prisma.order.count({ where }),
  ]);
  res.json({ orders, pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } });
});

adminOrderRoutes.get('/:id', requirePermission('orders:read'), async (req: AuthenticatedRequest, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { customer: { select: { id: true, email: true, phone: true, firstName: true, lastName: true, isVerified: true, isBlocked: true, totalOrders: true, totalSpent: true, createdAt: true } }, items: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } }, variant: { include: { images: { where: { isPrimary: true }, take: 1 } } } } }, statusHistory: { orderBy: { createdAt: 'asc' }, include: { admin: { select: { id: true, name: true } } } }, payments: true, returns: { include: { items: true } }, coupon: true },
  });
  if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
  res.json({ order });
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED']),
  note: z.string().optional(),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().optional(),
  trackingCompany: z.string().optional(),
});

adminOrderRoutes.patch('/:id/status', requirePermission('orders:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = updateStatusSchema.parse(req.body);
  
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { customer: { select: { firstName: true, lastName: true } } },
  });
  if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
  
  const updated = await prisma.$transaction(async (tx) => {
    const updateData: any = { status: data.status, updatedById: adminId };
    if (data.trackingNumber) updateData.trackingNumber = data.trackingNumber;
    if (data.trackingUrl) updateData.trackingUrl = data.trackingUrl;
    if (data.trackingCompany) updateData.trackingCompany = data.trackingCompany;
    if (data.status === 'CONFIRMED') updateData.confirmedAt = new Date();
    if (data.status === 'SHIPPED') updateData.shippedAt = new Date();
    if (data.status === 'DELIVERED') updateData.deliveredAt = new Date();
    if (data.status === 'CANCELLED') updateData.cancelledAt = new Date();
    
    const updated = await tx.order.update({ where: { id: req.params.id }, data: updateData });

    // Cancelling / returning / refunding an order must put the stock back AND
    // record the movement, so the InventoryMovement ledger stays symmetric with
    // the SALE rows written at checkout. `restoreOrderStock` is idempotent per
    // order, so replaying the same status does not double-restock.
    if (isRestockingStatus(data.status)) {
      const items = await tx.orderItem.findMany({
        where: { orderId: order.id },
        select: { variantId: true, quantity: true },
      });
      await restoreOrderStock(tx, items, {
        movementType: restockMovementTypeFor(data.status),
        reason: `Admin set status ${data.status}`,
        referenceId: order.id,
        orderNumber: order.orderNumber,
        adminId,
      });
    }
    
    await tx.orderStatusHistory.create({ data: { orderId: req.params.id, status: data.status, note: data.note, adminId } });
    
    await logAdminActivity(
      tx,
      {
        adminId,
        action: 'ORDER_STATUS_UPDATE',
        entityType: 'Order',
        entityId: req.params.id,
        oldData: { status: order.status },
        newData: { status: data.status },
      },
      req
    );
    
    return updated;
  });

  // Fire order-event notifications on the customer-facing transitions.
  const eventByStatus: Record<string, 'ORDER_CONFIRMED' | 'ORDER_SHIPPED' | 'ORDER_DELIVERED'> = {
    CONFIRMED: 'ORDER_CONFIRMED',
    SHIPPED: 'ORDER_SHIPPED',
    DELIVERED: 'ORDER_DELIVERED',
  };
  const event = eventByStatus[data.status];
  let whatsappUrl: string | null = null;
  if (event) {
    ({ whatsappUrl } = notifyOrderEvent(
      {
        id: updated.id,
        orderNumber: updated.orderNumber,
        email: updated.email,
        phone: updated.phone,
        total: Number(updated.total),
        currency: updated.currency,
        status: updated.status,
        trackingNumber: updated.trackingNumber,
        trackingUrl: updated.trackingUrl,
        trackingCompany: updated.trackingCompany,
        customerName:
          order.customer?.firstName || order.customer?.lastName
            ? `${order.customer?.firstName ?? ''} ${order.customer?.lastName ?? ''}`.trim()
            : null,
      },
      event,
      { adminId }
    ));
  }

  res.json({ message: 'Order status updated', order: updated, notifications: { whatsappUrl } });
});

adminOrderRoutes.post('/:id/notes', requirePermission('orders:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const { notes } = req.body;
  
  const order = await prisma.order.update({ where: { id: req.params.id }, data: { internalNotes: notes, updatedById: adminId } });
  
  await logAdminActivity(
    prisma,
    {
      adminId,
      action: 'ORDER_NOTES_UPDATE',
      entityType: 'Order',
      entityId: req.params.id,
      newData: { notes },
    },
    req
  );
  
  res.json({ message: 'Notes updated', order });
});