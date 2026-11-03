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
 * WhatsApp adapter.
 *
 * Two halves:
 *  - the wa.me deep link is built from the order alone and returned to the
 *    client (see `notifyOrderEvent`); it always works.
 *  - a server-side send, which is a stub behind WhatsApp Cloud API env vars.
 *    Business-initiated WhatsApp messages require a pre-approved template, so
 *    until the owner supplies credentials + a template we only record intent.
 */
export const whatsappChannel: NotificationChannel = {
  name: 'whatsapp',

  isConfigured(): boolean {
    return Boolean(config.whatsapp.accessToken && config.whatsapp.phoneNumberId);
  },

  async send(
    order: NotificationOrder,
    _event: OrderEvent,
    message: RenderedMessage
  ): Promise<ChannelSendResult> {
    const e164 = toE164(order.phone);
    if (!e164) {
      return { channel: this.name, ok: false, skipped: true, detail: 'no valid phone for whatsapp' };
    }

    if (!this.isConfigured()) {
      // Deep link is still surfaced to the customer; nothing to send server-side.
      return { channel: this.name, ok: true, skipped: true, configured: false, detail: 'deeplink_only' };
    }

    // Server-side send stub. Replace the payload with a real template send once
    // WhatsApp Business credentials + an approved template are provided.
    try {
      const url = `${config.whatsapp.apiBaseUrl}/${config.whatsapp.phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: e164.replace(/^\+/, ''),
          type: 'text',
          text: { body: message.body },
        }),
      });
      return {
        channel: this.name,
        ok: response.ok,
        detail: `whatsapp_api_${response.status}`,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error: any) {
      return { channel: this.name, ok: false, error: error?.message || 'whatsapp send failed' };
    }
  },
};

export default whatsappChannel;
