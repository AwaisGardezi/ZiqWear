import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * Unit tests for src/config.
 *
 * The module reads process.env at import time, so every env-sensitive test
 * re-imports it fresh with vi.resetModules() + a dynamic import. Env keys the
 * test cares about are stubbed BEFORE the import: config calls dotenv.config()
 * itself, and dotenv never overwrites a variable that is already defined, so a
 * stub always wins over backend/.env.
 *
 * No test asserts a value that backend/.env could legitimately change; each one
 * pins either a documented default, a hardcoded constant, or an explicit stub.
 */

const FALLBACK_JWT_SECRET = 'ziqwear-super-secret-key-change-in-production';

async function loadConfig() {
  vi.resetModules();
  const mod = await import('../src/config');
  return mod;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('config - defaults', () => {
  it('uses port 4000 when PORT is unset', async () => {
    vi.stubEnv('PORT', '');
    const { config } = await loadConfig();
    expect(config.port).toBe(4000);
  });

  it('parses PORT as a number when it is set', async () => {
    vi.stubEnv('PORT', '4321');
    const { config } = await loadConfig();
    expect(config.port).toBe(4321);
  });

  it('falls back to the development JWT secret when JWT_SECRET is blank', async () => {
    vi.stubEnv('JWT_SECRET', '');
    const { config } = await loadConfig();
    expect(config.jwt.secret).toBe(FALLBACK_JWT_SECRET);
  });

  it('honours an injected JWT_SECRET', async () => {
    vi.stubEnv('JWT_SECRET', 'a-ten-char-secret');
    const { config } = await loadConfig();
    expect(config.jwt.secret).toBe('a-ten-char-secret');
  });

  it('defaults the API prefix to /api/v1', async () => {
    const { config } = await loadConfig();
    expect(config.apiPrefix).toBe('/api/v1');
  });

  it('defaults the frontend and admin URLs to the local Vite ports', async () => {
    vi.stubEnv('FRONTEND_URL', '');
    vi.stubEnv('ADMIN_URL', '');
    const { config } = await loadConfig();
    expect(config.frontendUrl).toBe('http://localhost:3000');
    expect(config.adminUrl).toBe('http://localhost:3001');
  });

  it('falls back to a dev cookie secret when COOKIE_SECRET is blank', async () => {
    vi.stubEnv('COOKIE_SECRET', '');
    const { config } = await loadConfig();
    expect(config.cookie.secret).toBe('ziqwear-cookie-secret');
  });

  it('splits a comma-separated CORS_ORIGIN into a list', async () => {
    vi.stubEnv('CORS_ORIGIN', 'https://ziqwear.com,http://localhost:3000');
    const { config } = await loadConfig();
    expect(config.cors.origin).toEqual(['https://ziqwear.com', 'http://localhost:3000']);
  });

  it('always yields an array of strings for cors.origin', async () => {
    vi.stubEnv('CORS_ORIGIN', 'https://ziqwear.com');
    const { config } = await loadConfig();
    expect(Array.isArray(config.cors.origin)).toBe(true);
    for (const origin of config.cors.origin) expect(typeof origin).toBe('string');
  });

  it('falls back to the dev allow-list when CORS_ORIGIN is blank', async () => {
    // Previously an empty CORS_ORIGIN produced [""], which silently disabled
    // every cross-origin caller. Blank now means "use the defaults".
    vi.stubEnv('CORS_ORIGIN', '');
    const { config } = await loadConfig();
    expect(config.cors.origin).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8777',
    ]);
  });

  it('trims whitespace and drops empty entries from CORS_ORIGIN', async () => {
    vi.stubEnv('CORS_ORIGIN', 'https://ziqwear.com, ,https://admin.ziqwear.com,');
    const { config } = await loadConfig();
    expect(config.cors.origin).toEqual(['https://ziqwear.com', 'https://admin.ziqwear.com']);
  });

  it('keeps credentials enabled for CORS', async () => {
    const { config } = await loadConfig();
    expect(config.cors.credentials).toBe(true);
  });
});

describe('config - cookies and environment', () => {
  it('marks cookies secure only in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { config } = await loadConfig();
    expect(config.cookie.secure).toBe(true);
  });

  it('does not mark cookies secure in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { config } = await loadConfig();
    expect(config.cookie.secure).toBe(false);
  });

  it('sets sameSite to lax and a 7-day cookie lifetime', async () => {
    const { config } = await loadConfig();
    expect(config.cookie.sameSite).toBe('lax');
    expect(config.cookie.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('config - hardcoded policy constants', () => {
  it('pins the documented token lifetimes', async () => {
    const { config } = await loadConfig();
    expect(config.jwt.accessTokenExpiry).toBe('15m');
    expect(config.jwt.refreshTokenExpiry).toBe('7d');
    expect(config.jwt.adminTokenExpiry).toBe('8h');
  });

  it('pins the rate-limit window to 15 minutes / 100 requests', async () => {
    const { config } = await loadConfig();
    expect(config.rateLimit.windowMs).toBe(15 * 60 * 1000);
    expect(config.rateLimit.maxRequests).toBe(100);
  });

  it('limits uploads to 10MB and to image/video MIME types', async () => {
    const { config } = await loadConfig();
    expect(config.upload.maxFileSize).toBe(10 * 1024 * 1024);
    expect(config.upload.allowedMimeTypes).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'video/mp4',
      'video/webm',
    ]);
    // Text/HTML must never be an accepted upload type.
    expect(config.upload.allowedMimeTypes).not.toContain('text/html');
    expect(config.upload.allowedMimeTypes).not.toContain('application/octet-stream');
  });

  it('uses 12 bcrypt rounds', async () => {
    const { config } = await loadConfig();
    expect(config.bcryptRounds).toBe(12);
  });

  it('keeps loyalty tiers ordered and point-generating', async () => {
    const { config } = await loadConfig();
    const { tierThresholds, pointsPerCurrency, pointsValue } = config.loyalty;
    expect(tierThresholds.SILVER).toBe(0);
    expect(tierThresholds.GOLD).toBeGreaterThan(tierThresholds.SILVER);
    expect(tierThresholds.BLACK).toBeGreaterThan(tierThresholds.GOLD);
    expect(pointsPerCurrency).toBeGreaterThan(0);
    expect(pointsValue).toBeGreaterThan(0);
  });

  it('keeps shipping rules internally consistent', async () => {
    const { config } = await loadConfig();
    expect(config.shipping.freeShippingThreshold).toBe(5000);
    expect(config.shipping.defaultShippingFee).toBe(250);
    expect(config.shipping.freeShippingThreshold).toBeGreaterThan(config.shipping.defaultShippingFee);
  });

  it('defaults the SMTP port to 587 and secure only when SMTP_SECURE=true', async () => {
    vi.stubEnv('SMTP_PORT', '');
    vi.stubEnv('SMTP_SECURE', '');
    const a = await loadConfig();
    expect(a.config.email.port).toBe(587);
    expect(a.config.email.secure).toBe(false);

    vi.stubEnv('SMTP_SECURE', 'true');
    const b = await loadConfig();
    expect(b.config.email.secure).toBe(true);
  });

  it('exposes the same object as both named and default export', async () => {
    const mod = await loadConfig();
    expect(mod.default).toBe(mod.config);
  });
});

describe('assertProductionSecrets', () => {
  const LONG = 'a'.repeat(48);

  it('is a no-op outside production, even with blank secrets', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('JWT_SECRET', '');
    vi.stubEnv('COOKIE_SECRET', '');
    const mod = await loadConfig();
    expect(() => mod.assertProductionSecrets()).not.toThrow();
  });

  it('accepts two long, non-placeholder secrets and a database url', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', LONG);
    vi.stubEnv('COOKIE_SECRET', 'b'.repeat(40));
    const mod = await loadConfig();
    expect(() => mod.assertProductionSecrets()).not.toThrow();
  });

  it('rejects a blank JWT_SECRET in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', '');
    vi.stubEnv('COOKIE_SECRET', LONG);
    const mod = await loadConfig();
    expect(() => mod.assertProductionSecrets()).toThrow(/JWT_SECRET/);
  });

  it('rejects the development placeholder secrets', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', FALLBACK_JWT_SECRET);
    vi.stubEnv('COOKIE_SECRET', 'ziqwear-cookie-secret');
    const mod = await loadConfig();
    expect(() => mod.assertProductionSecrets()).toThrow(/JWT_SECRET.*COOKIE_SECRET/s);
  });

  it('rejects an unedited .env.example template value', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'replace-me-with-the-output-of-the-command-above-0000000000000000');
    vi.stubEnv('COOKIE_SECRET', LONG);
    const mod = await loadConfig();
    expect(() => mod.assertProductionSecrets()).toThrow(/JWT_SECRET/);
  });

  it('rejects a secret shorter than 32 characters', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'short-but-real-secret-value');
    vi.stubEnv('COOKIE_SECRET', LONG);
    const mod = await loadConfig();
    expect(() => mod.assertProductionSecrets()).toThrow(/at least 32 characters/);
  });

  it('reports every problem at once rather than one per boot', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', '');
    vi.stubEnv('COOKIE_SECRET', '');
    vi.stubEnv('DATABASE_URL', '');
    const mod = await loadConfig();
    expect(() => mod.assertProductionSecrets()).toThrow(/JWT_SECRET.*COOKIE_SECRET.*DATABASE_URL/s);
  });
});
