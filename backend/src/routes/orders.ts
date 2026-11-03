import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest, authMiddleware, optionalAuth } from '../middleware/auth';
import { config } from '../config';
import { commitOrderStock, restoreOrderStock, type OrderStockLine } from '../services/inventory';
import { notifyOrderEvent } from '../services/notifications';

export const orderRoutes = Router();

const shippingAddressSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  province: z.string().min(1),
  postalCode: z.string().optional(),
  country: z.string().optional().default('Pakistan'),
  phone: z.string().optional(),
  landmark: z.string().optional(),
});

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().optional(),
        handle: z.string().optional(),
        variantId: z.string().optional(),
        quantity: z.number().int().positive().max(99).default(1),
      })
    )
    .min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  shippingAddress: shippingAddressSchema,
  paymentMethod: z.enum(['COD', 'BANK_TRANSFER', 'CARD', 'STRIPE', 'JAZZCASH', 'EASYPAISA']).default('COD'),
  shippingMethod: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

const orderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

function generateOrderNumber() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `ZQ-${random}`;
}

// Create an order (works for guests and signed-in customers)
orderRoutes.post('/', optionalAuth, async (req: AuthenticatedRequest, res) => {
  const data = createOrderSchema.parse(req.body);

  const resolvedItems: Array<{
    product: any;
    variant: any;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    productTitle: string;
    variantLabel: string | null;
  }> = [];
  for (const item of data.items) {
    const product = await prisma.product.findFirst({
      where: {
        isActive: true,
        ...(item.productId ? { id: item.productId } : { handle: item.handle }),
      },
      include: { variants: { include: { inventory: true } } },
    });

    if (!product) throw new AppError('One of the products is no longer available', 400, 'PRODUCT_UNAVAILABLE');

    const variant =
      (item.variantId && product.variants.find((v) => v.id === item.variantId)) ||
      product.variants[0] ||
      null;

    const unitPrice = variant ? Number(variant.price) : Number(product.basePrice);
    const variantLabel = variant ? [variant.color, variant.size].filter(Boolean).join(' / ') || null : null;

    resolvedItems.push({
      product,
      variant,
      quantity: item.quantity,
      unitPrice,
      totalPrice: unitPrice * item.quantity,
      productTitle: product.title,
      variantLabel,
    });
  }

  const subtotal = resolvedItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const shippingTotal =
    subtotal >= config.shipping.freeShippingThreshold ? 0 : config.shipping.defaultShippingFee;
  const total = subtotal + shippingTotal;

  // Attach the order to a customer account when possible (created for guests).
  let customerId: string | null = req.customer?.id ?? null;
  if (!customerId) {
    const email = data.email.toLowerCase();
    const existing = await prisma.customer.findUnique({ where: { email } });
    if (existing) {
      customerId = existing.id;
    } else {
      const customer = await prisma.customer.create({
        data: {
          email,
          phone: data.phone,
          firstName: data.firstName || data.shippingAddress.firstName || null,
          lastName: data.lastName || data.shippingAddress.lastName || null,
          loyaltyAccount: { create: { tier: 'SILVER' } },
        },
      });
      customerId = customer.id;
    }
  }

  const orderNumber = generateOrderNumber();
  const loyaltyPoints = Math.floor(total / 100);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId,
        email: data.email.toLowerCase(),
        phone: data.phone,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        fulfillmentStatus: 'UNFULFILLED',
        paymentMethod: data.paymentMethod,
        subtotal,
        shippingTotal,
        total,
        shippingAddress: JSON.stringify(data.shippingAddress),
        shippingMethod: data.shippingMethod || 'standard',
        notes: data.notes,
        loyaltyPointsEarned: loyaltyPoints,
        items: {
          create: resolvedItems.map((item) => ({
            productId: item.product.id,
            variantId: item.variant?.id,
            title: item.product.title,
            sku: item.variant?.sku || item.product.sku,
            color: item.variant?.color,
            size: item.variant?.size,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            compareAtPrice: item.variant?.compareAtPrice ?? item.product.compareAtPrice ?? undefined,
            totalPrice: item.totalPrice,
          })),
        },
        statusHistory: {
          create: { status: 'PENDING', note: 'Order placed on the website' },
        },
        payments: {
          create: {
            method: data.paymentMethod,
            amount: total,
            status: 'PENDING',
          },
        },
      },
    });

    // Decrement stock and write an InventoryMovement row per line, inside the
    // same transaction so oversell rolls the whole order back.
    const stockLines: OrderStockLine[] = resolvedItems
      .filter((item) => item.variant)
      .map((item) => ({
        productId: item.product.id,
        variantId: item.variant.id,
        productTitle: item.productTitle,
        variantLabel: item.variantLabel,
        quantity: item.quantity,
      }));
    await commitOrderStock(tx, stockLines, {
      referenceId: created.id,
      referenceLabel: orderNumber,
      movementType: 'SALE',
    });

    if (customerId) {
      await tx.customer.update({
        where: { id: customerId },
        data: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: total },
          lastOrderAt: new Date(),
        },
      });

      const loyalty = await tx.loyaltyAccount.findUnique({ where: { customerId } });
      if (loyalty && loyaltyPoints > 0) {
        const balance = loyalty.pointsBalance + loyaltyPoints;
        await tx.loyaltyAccount.update({
          where: { customerId },
          data: {
            pointsBalance: balance,
            lifetimePoints: { increment: loyaltyPoints },
            lastActivityAt: new Date(),
          },
        });
        await tx.loyaltyTransaction.create({
          data: {
            accountId: loyalty.id,
            type: 'EARN',
            points: loyaltyPoints,
            balance,
            description: `Order ${orderNumber}`,
            referenceType: 'Order',
            referenceId: created.id,
          },
        });
      }
    }

    return created;
  });

  const fullOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { items: true, statusHistory: true, customer: { select: { firstName: true, lastName: true } } },
  });

  // Async, non-blocking order confirmation notification (email/SMS/WhatsApp).
  const { whatsappUrl } = notifyOrderEvent(
    {
      id: fullOrder!.id,
      orderNumber: fullOrder!.orderNumber,
      email: fullOrder!.email,
      phone: fullOrder!.phone,
      total: Number(fullOrder!.total),
      currency: fullOrder!.currency,
      status: fullOrder!.status,
      customerName:
        fullOrder!.customer?.firstName || fullOrder!.customer?.lastName
          ? `${fullOrder!.customer?.firstName ?? ''} ${fullOrder!.customer?.lastName ?? ''}`.trim()
          : null,
    },
    'ORDER_PLACED'
  );

  res.status(201).json({ message: 'Order placed', order: fullOrder, notifications: { whatsappUrl } });
});

// Look up an order without an account (order number + phone)
orderRoutes.get('/track', async (req, res) => {
  const query = z
    .object({
      orderNumber: z.string().min(3),
      phone: z.string().optional(),
      email: z.string().optional(),
    })
    .parse(req.query);

  // An order number alone is a guessable identifier; require one more matching
  // contact detail so /track cannot be used to dump other people's orders.
  if (!query.phone && !query.email) {
    throw new AppError(
      'Enter the phone number or email used on the order',
      400,
      'TRACK_VERIFICATION_REQUIRED'
    );
  }

  const order = await prisma.order.findFirst({
    where: {
      orderNumber: query.orderNumber,
      ...(query.phone ? { phone: { contains: query.phone.replace(/\D/g, '').slice(-10) } } : {}),
      ...(query.email ? { email: query.email.toLowerCase() } : {}),
    },
    include: { items: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
  });

  if (!order) throw new AppError('No order found with those details', 404, 'ORDER_NOT_FOUND');
  res.json({ order });
});

// List my orders
orderRoutes.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  // Paginated, newest first. The `orders` array shape is unchanged so existing
  // storefront code keeps working; `pagination` is purely additive.
  const q = orderListQuerySchema.parse(req.query);
  const where = { customerId: req.customer!.id };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.order.count({ where }),
  ]);

  res.json({
    orders,
    pagination: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
    },
  });
});

// Get one of my orders
orderRoutes.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, customerId: req.customer!.id },
    include: { items: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
  });
  if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
  res.json({ order });
});

// Cancel my order (only while pending)
orderRoutes.post('/:id/cancel', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, customerId: req.customer!.id },
    include: { items: true },
  });
  if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
  if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
    throw new AppError('This order can no longer be cancelled', 400, 'CANNOT_CANCEL');
  }

  // Only cancel from a still-cancellable status; the guard above runs before the
  // transaction, and the movement ledger keeps a double restock impossible.
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    // Return stock AND record one InventoryMovement row per line, so the ledger
    // stays symmetric with the SALE rows written at order creation.
    await restoreOrderStock(
      tx,
      order.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
      {
        movementType: 'CANCELLED',
        reason: 'Order cancelled by customer',
        referenceId: order.id,
        orderNumber: order.orderNumber,
      }
    );

    await tx.orderStatusHistory.create({
      data: { orderId: order.id, status: 'CANCELLED', note: 'Cancelled by customer' },
    });

    return result;
  });

  res.json({ message: 'Order cancelled', order: updated });
});
