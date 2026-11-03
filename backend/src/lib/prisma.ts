import { PrismaClient } from '@prisma/client';

/**
 * SQLite has no native JSON column, so document-like fields are stored as text.
 * This bridge keeps the rest of the code working with real objects and arrays:
 *  - on write, objects/arrays are stringified
 *  - on read, strings that look like JSON are parsed back
 *
 * Only the fields listed below are touched, so ordinary text fields are never
 * mutated.
 */
const JSON_FIELDS: Record<string, string[]> = {
  Product: ['tags'],
  Customer: ['tags'],
  SizeChart: [
    'chest', 'waist', 'hips', 'length', 'shoulder',
    'sleeve', 'inseam', 'rise', 'thigh', 'customFields',
  ],
  Order: ['shippingAddress', 'billingAddress'],
  Coupon: ['productIds', 'collectionIds', 'customerSegmentIds'],
  Review: ['images'],
  ReturnRequest: ['images'],
  ShippingZone: ['countries'],
  NewsletterSubscriber: ['tags'],
  CmsContent: ['content'],
  SiteSettings: [
    'socialLinks', 'themeColors', 'typography', 'announcementBar',
    'seoDefaults', 'shippingSettings', 'taxSettings', 'paymentSettings',
  ],
  SeoSetting: ['structuredData'],
  AbandonedCart: ['items'],
  AnalyticsEvent: ['properties'],
  AdminUser: ['permissions'],
  AdminActivityLog: ['oldData', 'newData'],
  Payment: ['gatewayResponse'],
};

const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'upsert',
]);

function encodeData(model: string, data: unknown): unknown {
  if (Array.isArray(data)) return data.map((entry) => encodeData(model, entry));
  if (!data || typeof data !== 'object') return data;

  const fields = JSON_FIELDS[model] || [];
  const source = data as Record<string, unknown>;
  const result: Record<string, unknown> = { ...source };

  for (const field of fields) {
    if (!(field in result)) continue;
    const value = result[field];
    // Prisma operations like { increment: 1 } must be left alone.
    if (value === null || value === undefined || typeof value === 'string') continue;
    result[field] = JSON.stringify(value);
  }

  // Nested writes (upsert create/update, connectOrCreate) inherit the same fields.
  for (const nested of ['create', 'update', 'data', 'createMany', 'updateMany']) {
    const value = result[nested];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[nested] = encodeData(model, value);
    }
  }

  return result;
}

function isPlainObject(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function looksLikeJson(value: string): boolean {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  );
}

function decodeValue(model: string, value: unknown, depth = 0): unknown {
  if (depth > 8) return value;

  if (Array.isArray(value)) {
    return value.map((entry) => decodeValue(model, entry, depth + 1));
  }
  if (!value || typeof value !== 'object' || value instanceof Date) return value;

  const fields = JSON_FIELDS[model] || [];
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(source)) {
    if (fields.includes(key) && typeof entry === 'string' && looksLikeJson(entry)) {
      try {
        result[key] = JSON.parse(entry);
        continue;
      } catch {
        result[key] = entry;
        continue;
      }
    }

    // Relations come back as nested objects/arrays from a different model.
    if (isPlainObject(entry) || Array.isArray(entry)) {
      result[key] = decodeRelation(entry, depth + 1);
      continue;
    }

    result[key] = entry;
  }

  return result;
}

/** Relations may contain JSON fields of their own model; decode by shape. */
function decodeRelation(value: unknown, depth: number): unknown {
  if (Array.isArray(value)) return value.map((entry) => decodeRelation(entry, depth + 1));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (typeof entry === 'string' && looksLikeJson(entry)) {
      try {
        result[key] = JSON.parse(entry);
        continue;
      } catch {
        result[key] = entry;
        continue;
      }
    }
    if (isPlainObject(entry) || Array.isArray(entry)) {
      result[key] = decodeRelation(entry, depth + 1);
      continue;
    }
    result[key] = entry;
  }
  return result;
}

const baseClient = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

const extendedClient = baseClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (WRITE_OPERATIONS.has(operation) && model) {
          const mutableArgs = args as Record<string, unknown>;
          if (mutableArgs.data !== undefined) {
            mutableArgs.data = encodeData(model, mutableArgs.data);
          }
          if (mutableArgs.create !== undefined) {
            mutableArgs.create = encodeData(model, mutableArgs.create);
          }
          if (mutableArgs.update !== undefined) {
            mutableArgs.update = encodeData(model, mutableArgs.update);
          }
        }

        const result = await query(args);
        if (!model) return result;
        return decodeValue(model, result);
      },
    },
  },
});

const globalForPrisma = globalThis as unknown as {
  prisma: typeof extendedClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? extendedClient;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
