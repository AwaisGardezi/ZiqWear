import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { restoreOrderStock } from '../../services/inventory';
import { AuthenticatedRequest, adminAuthMiddleware, requirePermission } from '../../middleware/auth';

export const adminReturnRoutes = Router();
adminReturnRoutes.use(adminAuthMiddleware);

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED', 'EXCHANGED']).optional(),
});

adminReturnRoutes.get('/', requirePermission('returns:read'), async (req: AuthenticatedRequest, res) => {
  const q = querySchema.parse(req.query);
  const where: any = {};
  if (q.status) where.status = q.status;

  const [returns, total] = await Promise.all([
    prisma.returnRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: {
        order: { select: { id: true, orderNumber: true, total: true } },
        customer: { select: { id: true, email: true, firstName: true, lastName: true } },
        items: { include: { orderItem: { include: { product: { select: { title: true } } } } } },
      },
    }),
    prisma.returnRequest.count({ where }),
  ]);

  res.json({ returns, pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } });
});

adminReturnRoutes.get('/:id', requirePermission('returns:read'), async (req: AuthenticatedRequest, res) => {
  const returnReq = await prisma.returnRequest.findUnique({
    where: { id: req.params.id },
    include: {
      order: { include: { items: { include: { product: true } } } },
      customer: { select: { id: true, email: true, phone: true, firstName: true, lastName: true, isVerified: true, isBlocked: true, totalOrders: true, totalSpent: true, createdAt: true } },
      items: { include: { orderItem: { include: { product: true, variant: true } } } },
    },
  });
  if (!returnReq) throw new AppError('Return request not found', 404, 'NOT_FOUND');
  res.json({ return: returnReq });
});

const updateSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED', 'EXCHANGED']),
  adminNotes: z.string().optional(),
  refundAmount: z.number().positive().optional(),
});

adminReturnRoutes.patch('/:id', requirePermission('returns:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = updateSchema.parse(req.body);

  const returnReq = await prisma.returnRequest.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { orderItem: true } }, order: true },
  });
  if (!returnReq) throw new AppError('Return request not found', 404, 'NOT_FOUND');

  const updated = await prisma.$transaction(async (tx) => {
    const updatedReturn = await tx.returnRequest.update({
      where: { id: req.params.id },
      data: { ...data, processedById: adminId, processedAt: new Date() },
    });

    if (data.status === 'APPROVED' || data.status === 'RECEIVED') {
      // Put the returned units back AND ledger them, capped at the quantity the
      // order line originally sold so repeated partial returns cannot inflate
      // stock. Shares the order as the ledger key, so an order that was already
      // cancelled/refunded does not restock a second time.
      await restoreOrderStock(
        tx,
        returnReq.items.map((item) => ({
          variantId: item.orderItem.variantId,
          quantity: item.quantity,
          maxQuantity: item.orderItem.quantity,
        })),
        {
          movementType: 'RETURN',
          reason: `Return ${returnReq.id} ${data.status.toLowerCase()}`,
          referenceId: returnReq.orderId,
          orderNumber: returnReq.order.orderNumber,
          referenceLabel: 'Return request',
          adminId,
        }
      );
    }

    if (data.status === 'REFUNDED' && returnReq.order.paymentStatus === 'PAID') {
      await tx.order.update({
        where: { id: returnReq.orderId },
        data: {
          paymentStatus: 'REFUNDED',
          refundedAt: new Date(),
          refundedAmount: data.refundAmount ?? returnReq.refundAmount,
        },
      });
      await tx.payment.create({
        data: {
          orderId: returnReq.orderId,
          method: returnReq.order.paymentMethod || 'COD',
          amount: data.refundAmount ?? returnReq.refundAmount ?? returnReq.order.total,
          status: 'REFUNDED',
          processedAt: new Date(),
        },
      });
    }

    await tx.adminActivityLog.create({
      data: {
        adminId,
        action: 'RETURN_UPDATE',
        entityType: 'ReturnRequest',
        entityId: req.params.id,
        newData: JSON.stringify(data),
      },
    });

    return updatedReturn;
  });

  res.json({ message: 'Return updated', return: updated });
});
