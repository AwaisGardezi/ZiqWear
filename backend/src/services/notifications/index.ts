import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { buildWhatsAppDeepLink } from './phone';
import { emailChannel } from './email';
import { whatsappChannel } from './whatsapp';
import { smsChannel } from './sms';
import type {
  ChannelSendResult,
  NotificationChannel,
  NotificationOrder,
  OrderEvent,
  RenderedMessage,
} from './types';

export * from './types';

const CHANNELS: NotificationChannel[] = [emailChannel, whatsappChannel, smsChannel];

/** Render the human-facing copy for an order event. */
export function renderOrderMessage(order: NotificationOrder, event: OrderEvent): RenderedMessage {
  const money = `${order.currency} ${Number(order.total).toLocaleString('en-US')}`;
  const first = order.customerName ? `, ${order.customerName.split(' ')[0]}` : '';

  switch (event) {
    case 'ORDER_PLACED':
    case 'ORDER_CONFIRMED':
      return {
        subject: `ZIQWEAR — Order ${order.orderNumber} confirmed`,
        body:
          `Hi${first}! Your ZIQWEAR order ${order.orderNumber} is confirmed${
            event === 'ORDER_CONFIRMED' ? '' : ' and being processed'
          }. Total ${money}. Track it here: ${config.frontendUrl}/orders?orderNumber=${order.orderNumber}`,
      };
    case 'ORDER_SHIPPED': {
      const tracking = order.trackingNumber
        ? ` Tracking: ${order.trackingCompany || 'courier'} ${order.trackingNumber}${
            order.trackingUrl ? ` ${order.trackingUrl}` : ''
          }.`
        : '';
      return {
        subject: `ZIQWEAR — Order ${order.orderNumber} shipped`,
        body: `Hi${first}! Order ${order.orderNumber} is on its way.${tracking}`,
      };
    }
    case 'ORDER_DELIVERED':
      return {
        subject: `ZIQWEAR — Order ${order.orderNumber} delivered`,
        body: `Hi${first}! Order ${order.orderNumber} has been delivered. Enjoy your pieces and tag us if you love them!`,
      };
    case 'PAYMENT_RECEIVED':
      return {
        subject: `ZIQWEAR — Payment received for ${order.orderNumber}`,
        body: `Hi${first}! We received your payment of ${money} for order ${order.orderNumber}. Thank you.`,
      };
    default:
      return {
        subject: `ZIQWEAR — Order ${order.orderNumber}`,
        body: `Update on your ZIQWEAR order ${order.orderNumber}.`,
      };
  }
}

/**
 * Exponential-backoff retry helper for a single channel send.
 * Never throws; returns the last result or an error-shaped result.
 */
async function withRetry<T extends ChannelSendResult>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 500
): Promise<T> {
  let last: T | undefined;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const result = await fn();
      last = result;
      // Success or a deliberate skip does not need a retry.
      if (result.ok || result.skipped) return result;
    } catch (error: any) {
      last = { channel: 'unknown', ok: false, error: error?.message || 'send threw' } as T;
    }
    if (i < attempts - 1) {
      const delay = baseDelayMs * 2 ** i;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return last as T;
}

let cachedSystemAdminId: string | null | undefined;

/** AdminActivityLog requires an adminId; fall back to the primary super admin. */
async function resolveSystemAdminId(): Promise<string | null> {
  if (cachedSystemAdminId !== undefined) return cachedSystemAdminId;
  try {
    const admin = await prisma.adminUser.findFirst({
      where: { isActive: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    cachedSystemAdminId = admin?.id ?? null;
  } catch {
    cachedSystemAdminId = null;
  }
  return cachedSystemAdminId;
}

async function runDelivery(
  order: NotificationOrder,
  event: OrderEvent,
  message: RenderedMessage,
  adminId?: string | null
): Promise<void> {
  const results = await Promise.all(
    CHANNELS.map((channel) =>
      withRetry(() => channel.send(order, event, message)).catch((error: any) => ({
        channel: channel.name,
        ok: false,
        error: error?.message || 'dispatch failed',
      }))
    )
  );

  // Audit trail for the notification dispatch. Never allowed to throw upward.
  try {
    const actorId = adminId ?? (await resolveSystemAdminId());
    if (actorId) {
      await prisma.adminActivityLog.create({
        data: {
          adminId: actorId,
          action: 'NOTIFICATION_SENT',
          entityType: 'Order',
          entityId: order.id,
          newData: JSON.stringify({ event, orderNumber: order.orderNumber, results }),
        },
      });
    } else {
      console.warn('[notifications] no admin available to attribute send log', {
        event,
        orderNumber: order.orderNumber,
        results,
      });
    }
  } catch (error) {
    console.error('[notifications] failed to write audit log', error);
  }
}

/**
 * Trigger order-event notifications.
 *
 * Returns synchronously with the WhatsApp deep link so the caller can include
 * it in the HTTP response. All actual delivery happens asynchronously and can
 * never block or fail the originating request.
 */
export function notifyOrderEvent(
  order: NotificationOrder,
  event: OrderEvent,
  opts: { adminId?: string | null } = {}
): { whatsappUrl: string | null } {
  let message: RenderedMessage;
  let whatsappUrl: string | null = null;
  try {
    message = renderOrderMessage(order, event);
    whatsappUrl = buildWhatsAppDeepLink(order.phone, message.body);
    // Fire and forget — swallow any scheduling error so the order request is safe.
    void runDelivery(order, event, message, opts.adminId).catch((error) =>
      console.error('[notifications] dispatch error', error)
    );
  } catch (error) {
    console.error('[notifications] failed to build message', error);
  }
  return { whatsappUrl };
}

export const notificationChannels = CHANNELS;
export { buildWhatsAppDeepLink } from './phone';
export default notifyOrderEvent;
