/**
 * Fields on a `Customer` row that must never leave the API, not even for admins.
 *
 * `passwordHash` is a bcrypt digest and the three token fields are live
 * account-recovery credentials: leaking them out of an admin response would let
 * anyone with a dashboard session take over the customer's account, so the
 * redaction happens at the serialization boundary rather than relying on every
 * route remembering to write a `select`.
 */
export const CUSTOMER_SECRET_FIELDS = [
  'passwordHash',
  'resetToken',
  'resetTokenExpiresAt',
  'verificationToken',
] as const;

/**
 * Shallow-redact a Customer-shaped object (or an array of them).
 * Non-objects pass through untouched, so this is safe to wrap around any
 * `res.json(...)` value.
 */
export function redactCustomer<T = unknown>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => redactCustomer(entry)) as unknown as T;
  if (!value || typeof value !== 'object' || value instanceof Date) return value;

  const source = value as Record<string, unknown>;
  if (!CUSTOMER_SECRET_FIELDS.some((field) => field in source)) return value;

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    if ((CUSTOMER_SECRET_FIELDS as readonly string[]).includes(key)) continue;
    result[key] = entry;
  }
  return result as unknown as T;
}

export default redactCustomer;
