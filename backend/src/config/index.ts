import dotenv from 'dotenv';
dotenv.config();

// Placeholder keys that are safe for local development and must never sign
// production traffic.
const DEV_JWT_SECRET = 'ziqwear-super-secret-key-change-in-production';
const DEV_COOKIE_SECRET = 'ziqwear-cookie-secret';

const DEV_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8777',
];

// An unset OR blank OR all-commas CORS_ORIGIN falls back to the dev allow-list;
// stray whitespace and empty entries are dropped rather than becoming "".
function parseCorsOrigins(raw: string | undefined): string[] {
  const list = (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : DEV_CORS_ORIGINS;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  // Behind nginx, set HOST=127.0.0.1 so the API is reachable only through the
  // TLS-terminating proxy instead of directly on the public interface.
  host: process.env.HOST || '0.0.0.0',
  apiPrefix: '/api/v1',
  
  // Database
  databaseUrl: process.env.DATABASE_URL!,
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || DEV_JWT_SECRET,
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    adminTokenExpiry: '8h',
  },
  
  // Cookies
  cookie: {
    secret: process.env.COOKIE_SECRET || DEV_COOKIE_SECRET,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  
  // CORS
  cors: {
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
    credentials: true,
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
  
  // Email (Nodemailer)
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
    from: process.env.SMTP_FROM || 'ZIQWEAR <noreply@ziqwear.com>',
  },
  
  // Shopify
  shopify: {
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    apiVersion: '2024-07',
  },
  
  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    currency: (process.env.STRIPE_CURRENCY || 'pkr').toLowerCase(),
  },

  // SendGrid (used by the email notification adapter when no SMTP is set)
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
  },

  // WhatsApp notifications. The wa.me deep link always works from the order
  // data alone; server-side sending only runs when an API token is configured.
  whatsapp: {
    apiBaseUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v20.0',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  },

  // SMS: provider-agnostic HTTP webhook adapter. The provider is intentionally
  // not hard-coded - point SMS_WEBHOOK_URL at any gateway that accepts
  // { to, message, reference } and returns 2xx on success.
  sms: {
    webhookUrl: process.env.SMS_WEBHOOK_URL,
    apiKey: process.env.SMS_API_KEY,
  },

  // Seed credentials (never hard-code these; see prisma/seed.ts)
  seed: {
    adminPassword: process.env.SEED_ADMIN_PASSWORD,
    customerPassword: process.env.SEED_CUSTOMER_PASSWORD,
  },

  // File uploads
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm'],
    uploadDir: process.env.UPLOAD_DIR || './uploads',
  },
  
  // Frontend URL
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  adminUrl: process.env.ADMIN_URL || 'http://localhost:3001',
  
  // Security
  bcryptRounds: 12,
  
  // Loyalty
  loyalty: {
    pointsPerCurrency: 1, // 1 point per PKR 1 spent
    pointsValue: 0.1, // 1 point = PKR 0.10
    tierThresholds: {
      SILVER: 0,
      GOLD: 50000, // 50,000 points
      BLACK: 200000, // 200,000 points
    },
    referralPoints: 1000,
    birthdayPoints: 5000,
  },
  
  // Shipping
  shipping: {
    freeShippingThreshold: 5000, // PKR
    defaultShippingFee: 250,
    codFee: 0,
  },
};

/**
 * Refuse to serve production traffic with borrowed signing keys. A default
 * JWT_SECRET is not a cosmetic issue: anyone who reads this file can mint an
 * admin token with it. Called once from index.ts before the port is bound.
 */
export function assertProductionSecrets(): void {
  if (config.nodeEnv !== 'production') return;

  const problems: string[] = [];

  // "replace-me..." is what .env.example ships with, so an unedited template
  // is caught the same way a leftover placeholder is.
  const unusable = (value: string | undefined, devConstant: string) =>
    !value ||
    value === devConstant ||
    /^replace-me\b/i.test(value) ||
    /your-|changeme|placeholder/i.test(value);

  if (unusable(process.env.JWT_SECRET, DEV_JWT_SECRET)) problems.push('JWT_SECRET is unset or still a template placeholder');
  else if (process.env.JWT_SECRET!.length < 32) problems.push('JWT_SECRET must be at least 32 characters');

  if (unusable(process.env.COOKIE_SECRET, DEV_COOKIE_SECRET)) problems.push('COOKIE_SECRET is unset or still a template placeholder');
  else if (process.env.COOKIE_SECRET!.length < 32) problems.push('COOKIE_SECRET must be at least 32 characters');

  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is not set');

  if (problems.length) {
    throw new Error(
      `Refusing to start in production — ${problems.join(', ')}. ` +
      'Fill in backend/.env (generate keys with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))")'
    );
  }
}

export default config;