import type { Request } from 'express';

/**
 * Reusable admin audit trail writer.
 *
 * Every admin mutation in `routes/admin/*` must record an `AdminActivityLog`
 * row. Historically this was a copy-pasted `prisma.adminActivityLog.create`
 * call; this helper centralises it so the shape (and the request context) stays
 * consistent, and so a mutation can never be committed without its log line.
 *
 * `db` is either the global `prisma` client or an interactive-transaction
 * client (`tx`). It is typed loosely because the shared JSON codec `$extends`
 * widens the concrete delegate types; the methods we call are identical on both.
 */
export interface AdminActivityEntry {
  adminId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldData?: unknown;
  newData?: unknown;
}

type AuditClient = {
  adminActivityLog: {
    create: (args: any) => Promise<unknown>;
  };
};

function stringifyAudit(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

/**
 * Fire-and-log helper. Await it inside a transaction so the log is atomic with
 * the mutation. For post-response logging you may call it without awaiting, but
 * the named admin mutations all await it to guarantee the audit entry lands.
 */
export async function logAdminActivity(
  db: AuditClient,
  entry: AdminActivityEntry,
  req?: Request
): Promise<void> {
  await db.adminActivityLog.create({
    data: {
      adminId: entry.adminId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? undefined,
      oldData: stringifyAudit(entry.oldData),
      newData: stringifyAudit(entry.newData),
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    },
  });
}

export default logAdminActivity;
