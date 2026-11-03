import { AppError } from '../../utils/AppError';
import { stripeProvider } from './stripe';
import { manualProvider } from './manual';
import { CARD_METHODS, MANUAL_METHODS, type PaymentMethod } from './types';

export * from './types';
export { stripeProvider } from './stripe';
export { manualProvider } from './manual';

export interface PaymentsStatus {
  stripe: boolean;
  manual: boolean;
}

export function providerStatus(): PaymentsStatus {
  return {
    stripe: stripeProvider.isConfigured(),
    manual: manualProvider.isConfigured(),
  };
}

/**
 * Resolve the provider for a payment method and enforce the env-gate.
 * A missing provider credential raises 503 payments_not_configured - never a
 * silent fallback to COD, which is how a shop loses money.
 */
export function requireProviderFor(method: PaymentMethod) {
  if (CARD_METHODS.includes(method)) {
    if (!stripeProvider.isConfigured()) {
      throw new AppError('payments_not_configured', 503, 'PAYMENTS_NOT_CONFIGURED');
    }
    return stripeProvider;
  }
  if (MANUAL_METHODS.includes(method)) {
    return manualProvider;
  }
  throw new AppError(`Unsupported payment method: ${method}`, 400, 'UNSUPPORTED_METHOD');
}

export default providerStatus;
