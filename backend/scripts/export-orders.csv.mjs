#!/usr/bin/env node
/**
 * export-orders.csv.mjs - dump the Order table to CSV for accounting / ops.
 *
 * CLI only: no HTTP route is registered and none should be added. The file
 * contains customer names, addresses, phone numbers and order values, so it
 * must stay out of version control and out of any public web root.
 *
 * One row per ORDER (not per line item). The items are collapsed into two
 * summary columns - itemCount and itemsSummary ("sku x qty | sku x qty") -
 * because a spreadsheet user expects one line per order. The line-level money
 * is still available in the order totals.
 *
 * PII SCOPE: the customer's email and phone are taken from the Order row
 * itself (they are denormalised onto the order at checkout), NOT from the
 * Customer record. That keeps the export to what the order actually contains
 * instead of pulling a customer's whole profile, marketing tags and loyalty
 * balance into a spreadsheet.
 *
 * USAGE
 *   node backend/scripts/export-orders.csv.mjs [options]
 *   npm run export:orders                    (from backend/)
 *
 * OPTIONS
 *   --out <file>        exact destination (default backend/exports/orders.csv)
 *   --dest-dir <dir>    folder for the default filename (env ZIQWEAR_EXPORT_DIR)
 *   --prefix <name>     default filename stem (default "orders")
 *   --timestamped       suffix the default filename with -YYYY-MM-DD-HHmmss
 *   --status <S>        only orders with this status (repeatable via CSV:
 *                       --status PENDING,PAID). Case-insensitive.
 *   --since <ISO date>  orders created at/after this date (e.g. 2026-01-01)
 *   --until <ISO date>  orders created at/before this date (inclusive of the day)
 *   --include-internal  also emit internalNotes (off by default: staff-only text)
 *   --escape-formulas   neutralise cells starting with = + - @ for Excel
 *   --help              show this message
 *
 * EXIT CODES
 *   0  CSV written
 *   1  failed (database unreachable, bad option, write error)
 */

import { parseArgs } from './lib/cli.mjs';
import { toCsv } from './lib/csv.mjs';
import { EXPORT_BOOLEAN_FLAGS, EXPORT_COMMON_FLAGS, reportUnknown, writeExport } from './lib/export.mjs';
import { createPrisma, describeDb } from './lib/db.mjs';

const BOOLEAN_FLAGS = [...EXPORT_BOOLEAN_FLAGS, 'include-internal', 'escape-formulas'];
const KNOWN_FLAGS = [...EXPORT_COMMON_FLAGS, 'status', 'since', 'until', 'include-internal', 'escape-formulas'];

const USAGE = [
  'Usage: node backend/scripts/export-orders.csv.mjs [options]',
  '',
  'Writes one CSV row per order to backend/exports/orders.csv by default.',
  'CLI only - no HTTP route is registered for this.',
  '',
  '  --out <file>        exact destination path',
  '  --dest-dir <dir>    folder for the default filename',
  '  --prefix <name>     default filename stem (default: orders)',
  '  --timestamped       suffix the default filename with the timestamp',
  '  --status <a,b>      filter by order status (comma separated)',
  '  --since <ISO>       created on/after this date',
  '  --until <ISO>       created on/before this date (end of that day)',
  '  --include-internal  emit internalNotes too',
  '  --escape-formulas   neutralise cells starting with = + - @ for Excel',
  '  --help              show this message',
  '',
  'WARNING: the output contains customer PII. Store it accordingly.',
].join('\n');

const ALWAYS_COLUMNS = [
  { key: 'orderNumber' },
  { key: 'id' },
  { key: 'status' },
  { key: 'paymentStatus' },
  { key: 'fulfillmentStatus' },
  { key: 'paymentMethod' },
  { key: 'email' },
  { key: 'phone' },
  { key: 'currency' },
  { key: 'subtotal' },
  { key: 'discountTotal' },
  { key: 'shippingTotal' },
  { key: 'taxTotal' },
  { key: 'total' },
  { key: 'refundedAmount' },
  { key: 'itemCount', value: (o) => (o.items || []).reduce((n, i) => n + i.quantity, 0) },
  {
    key: 'itemsSummary',
    value: (o) =>
      (o.items || [])
        .map((i) => `${i.sku} x${i.quantity}${i.size ? ` (${i.size})` : ''}`)
        .join(' | '),
  },
  { key: 'shippingAddress' },
  { key: 'billingAddress' },
  { key: 'shippingMethod' },
  { key: 'trackingNumber' },
  { key: 'trackingCompany' },
  { key: 'trackingUrl' },
  { key: 'loyaltyPointsEarned' },
  { key: 'loyaltyPointsRedeemed' },
  { key: 'utmSource' },
  { key: 'utmMedium' },
  { key: 'utmCampaign' },
  { key: 'notes' },
  { key: 'confirmedAt' },
  { key: 'shippedAt' },
  { key: 'deliveredAt' },
  { key: 'cancelledAt' },
  { key: 'cancelledReason' },
  { key: 'createdAt' },
  { key: 'updatedAt' },
];

const INTERNAL_COLUMN = { key: 'internalNotes' };

function parseDate(value, label) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`${label} is not a valid date: ${value}`);
  return d;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function buildWhere(args) {
  const where = {};

  if (typeof args.status === 'string' && args.status.length) {
    const statuses = args.status
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (statuses.length) where.status = { in: statuses };
  }

  const createdAt = {};
  if (typeof args.since === 'string' && args.since.length) {
    createdAt.gte = parseDate(args.since, '--since');
  }
  if (typeof args.until === 'string' && args.until.length) {
    const raw = args.until;
    const parsed = parseDate(raw, '--until');
    // A bare YYYY-MM-DD means "through the end of that day", not midnight.
    if (DATE_ONLY.test(raw)) {
      const end = new Date(parsed.getTime());
      end.setUTCDate(end.getUTCDate() + 1);
      end.setUTCMilliseconds(-1);
      createdAt.lte = end;
    } else {
      createdAt.lte = parsed;
    }
  }
  if (Object.keys(createdAt).length) where.createdAt = createdAt;

  return where;
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleanFlags: BOOLEAN_FLAGS, knownFlags: KNOWN_FLAGS });
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  reportUnknown(args);

  const prisma = createPrisma();
  try {
    console.log(`[export] database: ${describeDb()}`);

    const where = buildWhere(args);
    const orders = await prisma.order.findMany({
      where,
      include: { items: { select: { sku: true, quantity: true, size: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const columns = [...ALWAYS_COLUMNS];
    if (args['include-internal']) columns.push(INTERNAL_COLUMN);

    const csv = toCsv(orders, columns, { escapeFormulas: args['escape-formulas'] === true });
    writeExport(args, 'orders', csv);

    const units = orders.reduce((n, o) => n + (o.items || []).reduce((m, i) => m + i.quantity, 0), 0);
    console.log(`[export] rows: ${orders.length} order(s), ${units} line item(s)`);
    if (Object.keys(where).length) console.log(`[export] filter: ${JSON.stringify(where)}`);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(`[export] FAILED: ${err.message}`);
    process.exitCode = 1;
  });
