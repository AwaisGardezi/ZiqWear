export type PaymentMethod =
  | 'CARD'
  | 'STRIPE'
  | 'BANK_TRANSFER'
  | 'JAZZCASH'
  | 'EASYPAISA'
  | 'COD';

/** Manual (offline) rails that record a pending payment + proof upload. */
export const MANUAL_METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA'];

/** Card rails that go through Stripe. */
export const CARD_METHODS: PaymentMethod[] = ['CARD', 'STRIPE'];

/** Minimal provider contract: everything is env-gated and reported honestly. */
export interface PaymentProvider {
  readonly name: string;
  readonly methods: PaymentMethod[];
  isConfigured(): boolean;
}

export interface CreateIntentResult {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  provider: 'stripe';
  clientSecret: string;
  publishableKey: string | null;
  amount: number;
  currency: string;
}
