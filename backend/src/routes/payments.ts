import { Router } from 'express';
import path from 'node:path';
import { z } from 'zod';
import type { Response } from 'express';
import { AuthenticatedRequest, authMiddleware, adminAuthMiddleware, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/AppError';
import { stripeProvider, manualProvider, providerStatus } from '../services/payments';
import { proofUpload, UPLOAD_ROOT } from '../lib/upload';

export const paymentRoutes = Router();

/** The exact 503 shape the storefront/checkout looks for when a rail is off. */
function paymentsNotConfigured(res: Response): Response {
  return res.status(503).json({ error: 'payments_not_configured' });
}

/** Diagnostic: which payment rails are currently wired up. */
paymentRoutes.get('/status', (_req, res) => {
  res.json({ payments: providerStatus() });
});

// -------------------------------------------------------------- Stripe (card)
const intentSchema = z.object({ orderId: z.string().min(1) });

paymentRoutes.post('/stripe/intent', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!stripeProvider.isConfigured()) return paymentsNotConfigured(res);

  const { orderId } = intentSchema.parse(req.body);
  const result = await stripeProvider.createIntentForOrder(orderId, {
    customerId: req.customer?.id ?? null,
    isAdmin: Boolean(req.user),
  });
  res.json({ message: 'Payment intent created', ...result });
});

/**
 * Stripe webhook. The raw body is captured by `express.raw` in app.ts for this
 * exact path so the signature can be verified. Orders are only ever marked paid
 * here - never from client input - and delivery is idempotent via the event id.
 */
paymentRoutes.post('/stripe/webhook', async (req, res) => {
  if (!stripeProvider.isConfigured()) return paymentsNotConfigured(res);

  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') throw new AppError('Missing stripe-signature header', 400, 'MISSING_SIGNATURE');

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  const outcome = await stripeProvider.handleWebhook(rawBody, signature);
  res.json(outcome);
});

// ------------------------------------------------------- Manual / offline rails
const methodEnum = z.enum(['BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA']);

paymentRoutes.post(
  '/manual/proof',
  authMiddleware,
  (req, res, next) => proofUpload(req, res, (err: any) => (err ? next(err) : next())),
  async (req: any, res) => {
    const body = z
      .object({ orderId: z.string().min(1), method: methodEnum })
      .parse(req.body);

    if (!req.file) {
      throw new AppError('A proof-of-payment image is required', 400, 'PROOF_REQUIRED');
    }

    const result = await manualProvider.submitProof(body.orderId, body.method, req.file, {
      customerId: req.customer?.id ?? null,
      isAdmin: Boolean(req.user),
    });
    res.status(201).json({
      message: 'Proof of payment recorded, awaiting verification',
      paymentId: result.payment.id,
      status: result.payment.status,
      orderNumber: result.order.orderNumber,
    });
  }
);

/**
 * Serve a proof image back. Gated behind admin auth and constrained to the
 * uploads directory so an arbitrary path can never be read.
 */
paymentRoutes.get('/proof/:paymentId', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  const proof = await manualProvider.getProofFile(req.params.paymentId);
  if (!proof) throw new AppError('No proof on file for this payment', 404, 'PROOF_NOT_FOUND');

  // Only ever resolve a bare filename inside the uploads root (no traversal).
  if (proof.absolutePath.includes('/') || proof.absolutePath.includes('\\') || path.isAbsolute(proof.absolutePath)) {
    throw new AppError('Invalid proof path', 400, 'INVALID_PROOF_PATH');
  }
  const resolved = path.join(UPLOAD_ROOT, proof.absolutePath);
  if (!resolved.startsWith(UPLOAD_ROOT)) throw new AppError('Invalid proof path', 400, 'INVALID_PROOF_PATH');

  res.setHeader('Content-Type', proof.mimetype || 'image/jpeg');
  res.sendFile(resolved, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'proof_file_missing', code: 'PROOF_FILE_MISSING' });
    }
  });
});

/** Admin verifies a manual (bank/wallet) payment and marks the order paid. */
const verifySchema = z.object({ note: z.string().max(500).optional() });

paymentRoutes.post(
  '/:paymentId/verify',
  adminAuthMiddleware,
  requirePermission('orders:update'),
  async (req: AuthenticatedRequest, res) => {
    const { note } = verifySchema.parse(req.body ?? {});
    const payment = await manualProvider.verifyPayment(req.params.paymentId, req.user!.id, { note });
    res.json({ message: 'Payment verified and order marked paid', payment });
  }
);
