import path from 'node:path';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { notifyOrderEvent } from '../notifications';
import type { NotificationOrder } from '../notifications/types';
import { MANUAL_METHODS, type PaymentMethod, type PaymentProvider } from './types';

/**
 * Manual / offline payment rails (BANK_TRANSFER, JAZZCASH, EASYPAISA).
 *
 * There is no provider API to call, so we record a PENDING payment, let the
 * customer upload a proof-of-payment image, and only mark the order paid when
 * an admin verifies the deposit. Amounts are read from the DB, never the client.
 */

function isManualMethod(method: string): method is PaymentMethod {
  return (MANUAL_METHODS as string[]).includes(method);
}

function toNotificationOrder(order: any): NotificationOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    email: order.email,
    phone: order.phone,
    total: Number(order.total),
    currency: order.currency,
    status: order.status,
    customerName:
      order.customer?.firstName || order.customer?.lastName
        ? `${order.customer?.firstName ?? ''} ${order.customer?.lastName ?? ''}`.trim()
        : null,
  };
}

async function assertOwnership(order: any, opts: { customerId?: string | null; isAdmin?: boolean }) {
  if (!opts.isAdmin && opts.customerId && order.customerId !== opts.customerId) {
    throw new AppError('This order does not belong to you', 403, 'FORBIDDEN');
  }
}

/** Create or reuse a pending manual payment for the order. */
async function ensurePendingPayment(orderId: string, method: PaymentMethod) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  if (order.paymentStatus === 'PAID') {
    throw new AppError('This order is already paid', 409, 'ALREADY_PAID');
  }

  const existing = await prisma.payment.findFirst({
    where: { orderId, method, status: { in: ['PENDING', 'PROCESSING'] } },
  });
  if (existing) return { order, payment: existing };

  const payment = await prisma.payment.create({
    data: {
      orderId,
      method,
      amount: Number(order.total), // DB-authoritative
      currency: order.currency,
      status: 'PENDING',
    },
  });
  return { order, payment };
}

/**
 * Record a proof-of-payment upload for a manual rail.
 * `file` comes from the multer disk storage configured for uploads.
 */
async function submitProof(
  orderId: string,
  method: string,
  file: { filename: string; path: string; mimetype: string; size: number },
  opts: { customerId?: string | null; isAdmin?: boolean } = {}
) {
  if (!isManualMethod(method)) {
    throw new AppError(`${method} is not a supported manual payment method`, 400, 'UNSUPPORTED_METHOD');
  }

  const { order, payment } = await ensurePendingPayment(orderId, method);
  await assertOwnership(order, opts);

  const proof = {
    filename: file.filename,
    // Store relative to the uploads root so serving is portable across machines.
    filenamePath: path.basename(file.path),
    mimetype: file.mimetype,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'PROCESSING', // awaiting admin verification
      gatewayResponse: JSON.stringify({ method, proof, awaitingVerification: true }),
    },
  });

  return { payment: updated, order: { id: order.id, orderNumber: order.orderNumber } };
}

/** Admin verifies a manual payment and marks Payment + Order paid. */
async function verifyPayment(
  paymentId: string,
  adminId: string,
  opts: { note?: string } = {}
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: { include: { customer: { select: { firstName: true, lastName: true } } } } },
  });
  if (!payment) throw new AppError('Payment not found', 404, 'NOT_FOUND');
  if (!isManualMethod(payment.method)) {
    throw new AppError('Only manual payments are verified this way', 400, 'NOT_MANUAL_PAYMENT');
  }
  if (payment.status === 'PAID') {
    throw new AppError('Payment is already marked paid', 409, 'ALREADY_PAID');
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'PAID', processedAt: new Date(), gatewayResponse: JSON.stringify({ method: payment.method, verifiedBy: adminId, verifiedAt: new Date().toISOString(), note: opts.note }) },
    });

    const updateData: any = { paymentStatus: 'PAID' };
    if (payment.order.status === 'PENDING') {
      updateData.status = 'CONFIRMED';
      updateData.confirmedAt = new Date();
    }
    await tx.order.update({ where: { id: payment.orderId }, data: updateData });

    if (payment.order.status === 'PENDING') {
      await tx.orderStatusHistory.create({
        data: { orderId: payment.orderId, status: 'CONFIRMED', note: `Manual payment ${payment.method} verified by admin`, adminId },
      });
    }

    await tx.adminActivityLog.create({
      data: { adminId, action: 'PAYMENT_VERIFIED', entityType: 'Payment', entityId: payment.id, newData: JSON.stringify({ orderId: payment.orderId, method: payment.method, amount: Number(payment.amount) }) },
    });
  });

  notifyOrderEvent(toNotificationOrder(payment.order), 'PAYMENT_RECEIVED', { adminId });

  const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
  return updated;
}

/** Resolve the on-disk path of a stored proof file for authenticated serving. */
async function getProofFile(paymentId: string): Promise<{ absolutePath: string; filename: string; mimetype: string } | null> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new AppError('Payment not found', 404, 'NOT_FOUND');
  const proof = (payment.gatewayResponse as any)?.proof;
  if (!proof || !proof.filename) return null;
  return { absolutePath: proof.filenamePath, filename: proof.filename, mimetype: proof.mimetype };
}

export const manualProvider = {
  name: 'manual',
  methods: MANUAL_METHODS,
  // Manual rails need no provider credentials, so they are always available.
  isConfigured: () => true,
  submitProof,
  verifyPayment,
  getProofFile,
} satisfies PaymentProvider & {
  submitProof: typeof submitProof;
  verifyPayment: typeof verifyPayment;
  getProofFile: typeof getProofFile;
};

export default manualProvider;
