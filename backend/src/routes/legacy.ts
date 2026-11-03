import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { AppError } from '../utils/AppError';
import {
  commitOrderStock,
  restoreOrderStock,
  isRestockingStatus,
  restockMovementTypeFor,
  type OrderStockLine,
} from '../services/inventory';
import { notifyOrderEvent } from '../services/notifications';

/**
 * Compatibility layer for the original Ziqwear storefront (served at /legacy).
 * It exposes the /api/orders and /api/email endpoints the old pages call, but
 * reads and writes the same database as the new platform, so an order placed on
 * either storefront shows up in both admin panels.
 */
export const legacyRoutes = Router();

function toLegacyOrder(order: any) {
  const address = order.shippingAddress || {};
  return {
    id: order.orderNumber,
    createdAt: order.createdAt.getTime(),
    status: String(order.status || 'PENDING').toLowerCase(),
    items: (order.items || []).map((item: any) => ({
      key: `${item.productId}|${item.color || ''}|${item.size || ''}`,
      id: item.productId,
      title: item.title,
      handle: item.product?.handle,
      image: item.product?.images?.[0]?.url?.replace(/^\//, '') || '',
      price: Number(item.unitPrice),
      compareAt: item.compareAtPrice ? Number(item.compareAtPrice) : undefined,
      color: item.color,
      size: item.size,
      qty: item.quantity,
    })),
    subtotal: Number(order.subtotal),
    shipping: Number(order.shippingTotal),
    total: Number(order.total),
    customer: {
      name: [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ') || 'Guest',
      phone: order.phone,
      email: order.email,
      address: address.addressLine1 || '',
      city: address.city || '',
      province: address.province || '',
      postal: address.postalCode || '',
      landmark: address.landmark || '',
    },
    payment: String(order.paymentMethod || 'COD').toLowerCase() === 'cod' ? 'cod' : 'bank',
    notes: order.notes || '',
    channel: 'web',
  };
}

legacyRoutes.get('/orders', async (req, res) => {
  // The legacy storefront (assets/js/store.js and server.ps1) consumes this
  // response as a bare JSON array, so the envelope must never change.
  // `limit`/`page` are optional and only narrow the array.
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limitRaw = req.query.limit !== undefined ? parseInt(String(req.query.limit), 10) : NaN;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : undefined;

  const orders = await prisma.order.findMany({
    include: { customer: true, items: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } } },
    orderBy: { createdAt: 'desc' },
    ...(limit ? { skip: (page - 1) * limit, take: limit } : {}),
  });
  res.json(orders.map(toLegacyOrder));
});

legacyRoutes.post('/orders', async (req, res) => {
  const payload = req.body || {};
  const legacyId = String(payload.id || `ZQ-${Math.floor(100000 + Math.random() * 900000)}`);
  const customerInfo = payload.customer || {};

  const existing = await prisma.order.findFirst({
    where: { OR: [{ orderNumber: legacyId }, { legacyOrderId: legacyId }] },
  });
  if (existing) {
    res.json({ ok: true, id: existing.orderNumber });
    return;
  }

  const email = String(customerInfo.email || 'guest@ziqwear.com').toLowerCase();
  let customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer) {
    const nameParts = String(customerInfo.name || 'Guest Customer').split(' ');
    customer = await prisma.customer.create({
      data: {
        email,
        phone: customerInfo.phone || null,
        firstName: nameParts[0] || 'Guest',
        lastName: nameParts.slice(1).join(' ') || null,
        loyaltyAccount: { create: { tier: 'SILVER' } },
      },
    });
  }

  const items: Array<{
    productId: string;
    variantId: string | null;
    title: string;
    sku: string;
    color: string | null;
    size: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }> = [];
  const stockLines: OrderStockLine[] = [];

  for (const legacyItem of payload.items || []) {
    const product = await prisma.product.findFirst({
      where: { OR: [{ handle: legacyItem.handle }, { title: legacyItem.title }] },
      include: { variants: { include: { inventory: true } } },
    });
    if (!product) continue;

    const variant =
      product.variants.find((v) => v.color === legacyItem.color && v.size === legacyItem.size) ||
      product.variants[0];
    const quantity = Number(legacyItem.qty || 1);
    // Never trust the client price: unit price always comes from the DB row.
    const unitPrice = variant ? Number(variant.price) : Number(product.basePrice);
    const variantLabel = variant ? [variant.color, variant.size].filter(Boolean).join(' / ') || null : null;

    items.push({
      productId: product.id,
      variantId: variant?.id ?? null,
      title: legacyItem.title || product.title,
      sku: variant?.sku || product.sku,
      color: legacyItem.color || null,
      size: legacyItem.size || null,
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
    });

    if (variant) {
      stockLines.push({
        productId: product.id,
        variantId: variant.id,
        productTitle: product.title,
        variantLabel,
        quantity,
      });
    }
  }

  if (items.length === 0) {
    res.status(400).json({ ok: false, error: 'No matching products in the catalogue' });
    return;
  }

  // Totals are recomputed server-side from DB line prices, not client input.
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const shippingTotal = Number(payload.shipping ?? 0);
  const total = subtotal + shippingTotal;
  const status = String(payload.status || 'pending').toUpperCase();
  const allowedStatuses = [
    'PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED',
    'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED',
  ];
  const resolvedStatus = allowedStatuses.includes(status) ? status : 'PENDING';

  let createdOrder: { id: string; orderNumber: string; email: string; phone: string; currency: string };
  try {
    createdOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: legacyId,
          legacyOrderId: legacyId,
          customerId: customer.id,
          email,
          phone: customerInfo.phone || '0000000000',
          status: resolvedStatus,
          paymentStatus: 'PENDING',
          paymentMethod: String(payload.payment || 'cod').toLowerCase() === 'cod' ? 'COD' : 'BANK_TRANSFER',
          subtotal,
          shippingTotal,
          total,
          notes: payload.notes || null,
          shippingAddress: JSON.stringify({
            firstName: customerInfo.name?.split(' ')[0] || '',
            lastName: customerInfo.name?.split(' ').slice(1).join(' ') || '',
            addressLine1: customerInfo.address || '',
            city: customerInfo.city || '',
            province: customerInfo.province || '',
            postalCode: customerInfo.postal || '',
            country: 'Pakistan',
            phone: customerInfo.phone || '',
            landmark: customerInfo.landmark || '',
          }),
          createdAt: payload.createdAt ? new Date(Number(payload.createdAt)) : new Date(),
          items: { create: items },
          statusHistory: { create: { status: 'PENDING', note: 'Order placed on the legacy storefront' } },
          payments: { create: { method: String(payload.payment || 'cod').toLowerCase() === 'cod' ? 'COD' : 'BANK_TRANSFER', amount: total, status: 'PENDING' } },
        },
      });

      // Decrement stock + write InventoryMovement rows, atomically with the order.
      await commitOrderStock(tx, stockLines, {
        referenceId: order.id,
        referenceLabel: order.orderNumber,
        movementType: 'SALE',
      });

      await tx.customer.update({
        where: { id: customer.id },
        data: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: total },
          lastOrderAt: new Date(),
        },
      });

      return order;
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 409) {
      res.status(409).json({ ok: false, error: error.message, code: error.code, details: error.details });
      return;
    }
    throw error;
  }

  notifyOrderEvent(
    {
      id: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      email: createdOrder.email,
      phone: createdOrder.phone,
      total,
      currency: createdOrder.currency,
      status: resolvedStatus,
    },
    'ORDER_PLACED'
  );

  res.json({ ok: true, id: createdOrder.orderNumber });
});

legacyRoutes.post('/orders/status', async (req, res) => {
  const orderId = String(req.body.orderId || '');
  const status = String(req.body.status || '').toUpperCase();
  const allowed = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED'];

  if (!orderId || !allowed.includes(status)) {
    res.status(400).json({ ok: false, error: 'orderId and a valid status are required' });
    return;
  }

  const order = await prisma.order.findFirst({
    where: { OR: [{ orderNumber: orderId }, { legacyOrderId: orderId }, { id: orderId }] },
  });
  if (!order) {
    res.status(404).json({ ok: false, error: 'Order not found' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status } });
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, status, note: 'Updated from the legacy admin panel' },
    });

    // Same rule as the v1 admin route: a cancel/return/refund puts stock back
    // and writes the matching InventoryMovement row. `restoreOrderStock` is
    // idempotent per order, so re-sending the same status cannot restock twice.
    if (isRestockingStatus(status)) {
      const items = await tx.orderItem.findMany({
        where: { orderId: order.id },
        select: { variantId: true, quantity: true },
      });
      await restoreOrderStock(tx, items, {
        movementType: restockMovementTypeFor(status),
        reason: `Legacy status update to ${status}`,
        referenceId: order.id,
        orderNumber: order.orderNumber,
      });
    }
  });

  res.json({ ok: true });
});

legacyRoutes.post('/orders/delete', async (req, res) => {
  const orderId = String(req.body.orderId || '');
  if (!orderId) {
    res.status(400).json({ ok: false, error: 'orderId is required' });
    return;
  }

  const order = await prisma.order.findFirst({
    where: { OR: [{ orderNumber: orderId }, { legacyOrderId: orderId }, { id: orderId }] },
  });
  if (!order) {
    res.status(404).json({ ok: false, error: 'Order not found' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Deleting an order removes its sale from the shelf, so return the stock the
    // same way a cancel does. Items are read before `delete`, because OrderItem
    // cascades away with the order row.
    const items = await tx.orderItem.findMany({
      where: { orderId: order.id },
      select: { variantId: true, quantity: true },
    });

    // Restock is keyed on the order id, so it is idempotent against anything the
    // ledger already holds for that order: an order already cancelled, refunded
    // or returned (or a prior delete) has RESTOCK movement rows summing to the
    // sold quantity, so `remaining` collapses to 0 and nothing is put back twice.
    await restoreOrderStock(tx, items, {
      movementType: 'CANCELLED',
      reason: 'Order deleted',
      referenceId: order.id,
      orderNumber: order.orderNumber,
    });

    await tx.order.delete({ where: { id: order.id } });
  });

  res.json({ ok: true });
});

// Contact / notification email used by the old storefront
legacyRoutes.post('/email', async (req, res) => {
  const { subject, message, replyTo, toEmail } = req.body || {};

  if (!message) {
    res.status(400).json({ ok: false, error: 'Message is empty' });
    return;
  }

  if (!config.email.user || !config.email.pass) {
    res.status(503).json({
      ok: false,
      error: 'Email is not configured. Add SMTP_USER and SMTP_PASS to backend/.env to enable it.',
    });
    return;
  }

  try {
    // Loaded lazily so the API still starts when email is not configured.
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: { user: config.email.user, pass: config.email.pass },
    });

    await transporter.sendMail({
      from: config.email.from,
      to: toEmail || config.email.user,
      subject: subject || 'ZIQWEAR website message',
      text: message,
      replyTo: replyTo || undefined,
    });

    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || 'Could not send email' });
  }
});
