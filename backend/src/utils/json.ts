/**
 * Documents (arrays, objects) are stored in SQLite text columns.
 * Use this on write so the value is stored as valid JSON.
 */
export function jsonField(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value ?? null);
}
