/**
 * Order-event notification framework.
 *
 * One channel interface with three adapters (email, whatsapp, sms). Delivery
 * is fire-and-forget: the dispatcher must never block or fail the order request
 * that triggered it, retries with backoff, and every outcome is logged to
 * AdminActivityLog.
 */

export type OrderEvent =
  | 'ORDER_PLACED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'PAYMENT_RECEIVED';

/** The subset of an Order the notification layer needs. */
export interface NotificationOrder {
  id: string;
  orderNumber: string;
  email: string;
  phone: string;
  total: number;
  currency: string;
  status?: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  trackingCompany?: string | null;
  customerName?: string | null;
}

export interface RenderedMessage {
  subject: string;
  body: string;
}

export interface ChannelSendResult {
  channel: string;
  ok: boolean;
  skipped?: boolean;
  configured?: boolean;
  detail?: string;
  error?: string;
}

/** A notification transport. Implementations must not throw from `send`. */
export interface NotificationChannel {
  readonly name: string;
  /** True when the required env vars are present; otherwise sends are skipped. */
  isConfigured(): boolean;
  /** Deliver the message. Resolve with a result; never reject the caller. */
  send(order: NotificationOrder, event: OrderEvent, message: RenderedMessage): Promise<ChannelSendResult>;
}
