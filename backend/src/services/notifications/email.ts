import { config } from '../../config';
import type {
  ChannelSendResult,
  NotificationChannel,
  NotificationOrder,
  OrderEvent,
  RenderedMessage,
} from './types';

/**
 * Email adapter.
 *
 * Prefers SendGrid when SENDGRID_API_KEY is set, otherwise SMTP via
 * Nodemailer. If neither is configured the send is skipped (never a silent
 * COD-style fallback) and reported back to the dispatcher for logging.
 */
export const emailChannel: NotificationChannel = {
  name: 'email',

  isConfigured(): boolean {
    return Boolean(config.sendgrid.apiKey) || Boolean(config.email.user && config.email.pass);
  },

  async send(
    order: NotificationOrder,
    _event: OrderEvent,
    message: RenderedMessage
  ): Promise<ChannelSendResult> {
    if (!order.email) {
      return { channel: this.name, ok: false, skipped: true, detail: 'no recipient email' };
    }
    if (!this.isConfigured()) {
      return { channel: this.name, ok: false, skipped: true, configured: false, detail: 'email_not_configured' };
    }

    try {
      if (config.sendgrid.apiKey) {
        // Lazy import so the app boots without the dependency configured.
        const sg = (await import('@sendgrid/mail')).default;
        sg.setApiKey(config.sendgrid.apiKey);
        await sg.send({
          to: order.email,
          from: config.email.from,
          subject: message.subject,
          text: message.body,
        });
        return { channel: this.name, ok: true, detail: 'sendgrid' };
      }

      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: { user: config.email.user, pass: config.email.pass },
      });
      await transporter.sendMail({
        from: config.email.from,
        to: order.email,
        subject: message.subject,
        text: message.body,
      });
      return { channel: this.name, ok: true, detail: 'smtp' };
    } catch (error: any) {
      return { channel: this.name, ok: false, error: error?.message || 'email send failed' };
    }
  },
};

export default emailChannel;
