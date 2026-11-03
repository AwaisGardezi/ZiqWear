import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { AppError } from '../../utils/AppError';
import { notifyOrderEvent } from '../notifications';
import type { NotificationOrder } from '../notifications/types';
import { isEventProcessed, markEventProcessed } from './event-store';
import type { CreateIntentResult, PaymentProvider } from './types';

/**
 * Stripe card payments.
 *
 * Money rule: the chargeable amount is ALWAYS read from the order in the DB and
 * an order is only ever marked paid by the webhook, which we verify with the
 * signing secret. Client input never sets an amount or a paid status.
 */

let cachedStripe: Stripe | null = null;

function isConfigured(): boolean {
  return Boolean(config.stripe.secretKey && config.stripe.webhookSecret);
}

function requireClient(): Stripe {
  if (!config.stripe.secretKey || !config.stripe.webhookSecret) {
    throw new AppError('payments_not_configured', 503, 'PAYMENTS_NOT_CONFIGURED');
  }
  if (!cachedStripe) {
    cachedStripe = new Stripe(config.stripe.secretKey, { typescript: true });
  }
  return cachedStripe;
}

function amountToMinor(value: number): number {
  // Stripe expects the smallest currency unit; PKR has 100 paisa.
  return Math.round(value * 100);
}

function minorToAmount(minor?: number | null): number {
  return (minor ?? 0) / 100;
}

function toNotificationOrder(order: {
  id: string;
  orderNumber: string;
  email: string;
  phone: string;
  total: unknown;
  currency: string;
  status?: string;
  customer?: { firstName?: string | null; lastName?: string | null } | null;
}): NotificationOrder {
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

async function createIntentForOrder(
  orderId: string,
  opts: { customerId?: string | null; isAdmin?: boolean } = {}
): Promise<CreateIntentResult> {
  const stripe = requireClient();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true, customer: { select: { firstName: true, lastName: true } } },
  });
  if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');

  if (!opts.isAdmin && opts.customerId && order.customerId !== opts.customerId) {
    throw new AppError('This order does not belong to you', 403, 'FORBIDDEN');
  }

  if (order.paymentStatus === 'PAID') {
    throw new AppError('This order is already paid', 409, 'ALREADY_PAID');
  }

  // Authoritative amount straight from the DB row.
  const amount = Number(order.total);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError('Order total is invalid, cannot charge', 400, 'INVALID_ORDER_AMOUNT');
  }
  const currency = (order.currency || config.stripe.currency || 'pkr').toLowerCase();

  // Reuse an existing pending card payment when present, else create one.
  let payment =
    order.payments.find((p) => ['CARD', 'STRIPE'].includes(p.method) && p.status === 'PENDING') ?? null;
  if (!payment) {
    payment = await prisma.payment.create({
      data: { orderId: order.id, method: 'CARD', amount, currency, status: 'PENDING' },
    });
  }

  const intent = await stripe.paymentIntents.create({
    amount: amountToMinor(amount),
    currency,
    description: `ZIQWEAR order ${order.orderNumber}`,
    receipt_email: order.email || undefined,
    metadata: { orderId: order.id, paymentId: payment.id, orderNumber: order.orderNumber },
  });

  if (!intent.client_secret) {
    throw new AppError('Stripe did not return a client secret', 502, 'STRIPE_ERROR');
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { transactionId: intent.id, gatewayResponse: JSON.stringify({ intentId: intent.id, status: intent.status }) },
  });

  return {
    paymentId: payment.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    provider: 'stripe',
    clientSecret: intent.client_secret as string,
    publishableKey: config.stripe.publishableKey ?? null,
    amount,
    currency,
  };
}

/**
 * Reconcile a succeeded payment. Verifies the captured amount against the DB
 * before flipping Payment + Order to paid. Idempotent at the row level too.
 */
async function markPaymentSucceeded(paymentId: string | null, intent: Stripe.PaymentIntent): Promise<string | null> {
  const payment = paymentId
    ? await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } })
    : await prisma.payment.findFirst({
        where: { transactionId: intent.id, method: { in: ['CARD', 'STRIPE'] } },
        include: { order: true },
      });
  if (!payment) {
    console.warn('[payments.stripe] webhook for unknown payment', { paymentId, intentId: intent.id });
    return null;
  }
  if (payment.status === 'PAID') return payment.orderId; // already reconciled

  const expected = Number(payment.amount);
  const received = minorToAmount(intent.amount_received ?? intent.amount);
  if (received + 0.01 < expected) {
    // Under-payment: record what arrived but do NOT mark paid from client-side.
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PENDING',
        gatewayResponse: JSON.stringify({ intentId: intent.id, status: intent.status, received, expected, note: 'underpaid' }),
      },
    });
    console.warn('[payments.stripe] underpayment detected', { paymentId: payment.id, received, expected });
    return payment.orderId;
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        processedAt: new Date(),
        transactionId: intent.id,
        gatewayResponse: JSON.stringify({ intentId: intent.id, status: 'succeeded', received, expected }),
      },
    });

    const order = await tx.order.findUnique({ where: { id: payment.orderId } });
    const updateData: any = { paymentStatus: 'PAID' };
    const willConfirm = order && order.status === 'PENDING';
    if (willConfirm) {
      updateData.status = 'CONFIRMED';
      updateData.confirmedAt = new Date();
    }
    await tx.order.update({ where: { id: payment.orderId }, data: updateData });

    if (willConfirm) {
      await tx.orderStatusHistory.create({
        data: { orderId: payment.orderId, status: 'CONFIRMED', note: 'Payment confirmed via Stripe' },
      });
    }
  });

  const fullOrder = await prisma.order.findUnique({
    where: { id: payment.orderId },
    include: { customer: { select: { firstName: true, lastName: true } } },
  });
  if (fullOrder) notifyOrderEvent(toNotificationOrder(fullOrder), 'PAYMENT_RECEIVED');

  return payment.orderId;
}

async function handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<{
  received: boolean;
  duplicate?: boolean;
  handled?: string;
}> {
  const stripe = requireClient();
  if (!signature) throw new AppError('Missing stripe-signature header', 400, 'MISSING_SIGNATURE');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret!);
  } catch (error: any) {
    throw new AppError('Invalid webhook signature', 400, 'WEBHOOK_SIGNATURE_INVALID');
  }

  if (isEventProcessed(event.id)) {
    return { received: true, duplicate: true, handled: event.type };
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent;
      await markPaymentSucceeded(intent.metadata?.paymentId ?? null, intent);
      break;
    }
    case 'charge.succeeded': {
      const charge = event.data.object as Stripe.Charge;
      const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      const payment = await prisma.payment.findFirst({ where: { transactionId: intentId ?? '' } });
      if (payment && payment.status !== 'PAID') {
        // Re-use the reconciliation path with a synthesised intent shape.
        const chargeAny = charge as any;
        await markPaymentSucceeded(payment.id, {
          id: intentId ?? '',
          amount: charge.amount,
          amount_received: chargeAny.amount_received,
          status: 'succeeded',
          metadata: { paymentId: payment.id },
        } as unknown as Stripe.PaymentIntent);
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object as Stripe.PaymentIntent;
      const payment = intent.metadata?.paymentId
        ? await prisma.payment.findUnique({ where: { id: intent.metadata.paymentId } })
        : await prisma.payment.findFirst({ where: { transactionId: intent.id } });
      if (payment && payment.status !== 'PAID') {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            failureReason: intent.last_payment_error?.message ?? 'Payment failed',
            gatewayResponse: JSON.stringify({ intentId: intent.id, status: 'failed' }),
          },
        });
      }
      break;
    }
    default:
      // Unhandled event types are acknowledged so Stripe stops retrying them.
      markEventProcessed(event.id);
      return { received: true, handled: event.type };
  }

  // Only commit idempotency after successful processing so failures can retry.
  markEventProcessed(event.id);
  return { received: true, handled: event.type };
}

export const stripeProvider = {
  name: 'stripe',
  methods: ['CARD', 'STRIPE'],
  isConfigured,
  createIntentForOrder,
  handleWebhook,
} satisfies PaymentProvider & {
  createIntentForOrder: typeof createIntentForOrder;
  handleWebhook: typeof handleWebhook;
};

export default stripeProvider;
