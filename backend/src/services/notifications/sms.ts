import { config } from '../../config';
import { toE164 } from './phone';
import type {
  ChannelSendResult,
  NotificationChannel,
  NotificationOrder,
  OrderEvent,
  RenderedMessage,
} from './types';

/**
 * SMS adapter - deliberately vendor-agnostic.
 *
 * Point SMS_WEBHOOK_URL at any gateway that accepts a JSON body
 * `{ to, message, reference }` and returns 2xx on success. Set SMS_API_KEY to
 * send it as a Bearer token. Without SMS_WEBHOOK_URL the channel is treated as
 * not configured and skipped (never a silent fallback).
 */
export const smsChannel: NotificationChannel = {
  name: 'sms',

  isConfigured(): boolean {
    return Boolean(config.sms.webhookUrl);
  },

  async send(
    order: NotificationOrder,
    _event: OrderEvent,
    message: RenderedMessage
  ): Promise<ChannelSendResult> {
    const e164 = toE164(order.phone);
    if (!e164) {
      return { channel: this.name, ok: false, skipped: true, detail: 'no valid phone for sms' };
    }

    if (!this.isConfigured()) {
      return { channel: this.name, ok: false, skipped: true, configured: false, detail: 'sms_not_configured' };
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (config.sms.apiKey) headers.Authorization = `Bearer ${config.sms.apiKey}`;

      const response = await fetch(config.sms.webhookUrl!, {
        method: 'POST',
        headers,
        body: JSON.stringify({ to: e164, message: message.body, reference: order.orderNumber }),
      });

      return {
        channel: this.name,
        ok: response.ok,
        detail: `sms_webhook_${response.status}`,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error: any) {
      return { channel: this.name, ok: false, error: error?.message || 'sms send failed' };
    }
  },
};

export default smsChannel;
