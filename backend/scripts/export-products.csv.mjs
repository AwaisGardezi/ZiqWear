#!/usr/bin/env node
/**
 * export-products.csv.mjs - dump the Product table to CSV for ops and imports.
 *
 * CLI only: no HTTP route is registered and none should be added, because the
 * export contains cost prices and no auth/permission check happens here.
 *
 * Reads through the generated Prisma client (not src/lib/prisma.ts), so
 * document-like columns keep their literal on-disk representation: SQLite has
 * no JSON type, so Product.tags is stored as a JSON *string* and that is what
 * lands in the CSV. import-products.csv.mjs accepts both that JSON form and a
 * plain comma-separated list, so the file round-trips.
 *
 * USAGE
 *   node backend/scripts/export-products.csv.mjs [options]
 *   npm run export:products                   (from backend/)
 *
 * OPTIONS
 *   --out <file>       exact destination (default backend/exports/products.csv)
 *   --dest-dir <dir>   folder for the default filename (env ZIQWEAR_EXPORT_DIR)
 *   --prefix <name>    default filename stem  (default "products")
 *   --timestamped      add -YYYY-MM-DD-HHmmss to the default filename
 *   --active-only      skip rows with isActive = false
 *   --escape-formulas  prefix cells starting with = + - @ with an apostrophe so
 *                      Excel does not execute them (breaks exact round-trip)
 *   --help             show this message
 *
 * The database used is whatever DATABASE_URL resolves to (backend/.env unless
 * overridden). Point DATABASE_URL at a copy to rehearse.
 *
 * EXIT CODES
 *   0  CSV written
 *   1  failed (database unreachable, bad option, write error)
 */

import { parseArgs } from './lib/cli.mjs';
import { toCsv } from './lib/csv.mjs';
import { EXPORT_BOOLEAN_FLAGS, EXPORT_COMMON_FLAGS, reportUnknown, writeExport } from './lib/export.mjs';
import { createPrisma, describeDb } from './lib/db.mjs';

const KNOWN_FLAGS = [...EXPORT_COMMON_FLAGS, 'active-only', 'escape-formulas'];
const BOOLEAN_FLAGS = [...EXPORT_BOOLEAN_FLAGS, 'active-only', 'escape-formulas'];

const USAGE = [
  'Usage: node backend/scripts/export-products.csv.mjs [options]',
  '',
  'Writes the Product table to CSV (default backend/exports/products.csv).',
  'CLI only - no HTTP route is registered for this.',
  '',
  '  --out <file>        exact destination path',
  '  --dest-dir <dir>    folder for the default filename',
  '  --prefix <name>     default filename stem (default: products)',
  '  --timestamped       suffix the default filename with the timestamp',
  '  --active-only       skip rows where isActive is false',
  '  --escape-formulas   neutralise cells starting with = + - @ for Excel',
  '  --help              show this message',
  '',
  'Env: DATABASE_URL selects the database; ZIQWEAR_EXPORT_DIR overrides --dest-dir.',
].join('\n');

/** Column order is a contract with import-products.csv.mjs - extend, do not reorder. */
const COLUMNS = [
  { key: 'id' },
  { key: 'handle' },
  { key: 'sku' },
  { key: 'title' },
  { key: 'description' },
  { key: 'shortDescription' },
  { key: 'barcode' },
  { key: 'categorySlug', value: (p) => p.category?.slug ?? '' },
  { key: 'categoryName', value: (p) => p.category?.name ?? '' },
  { key: 'basePrice' },
  { key: 'compareAtPrice' },
  { key: 'costPrice' },
  { key: 'weight' },
  { key: 'weightUnit' },
  { key: 'fabric' },
  { key: 'gsm' },
  { key: 'fit' },
  { key: 'careInstructions' },
  { key: 'isActive' },
  { key: 'isFeatured' },
  { key: 'isNewArrival' },
  { key: 'isBestseller' },
  { key: 'isLimitedEdition' },
  { key: 'limitedEditionNumber' },
  { key: 'limitedEditionTotal' },
  { key: 'launchDate' },
  { key: 'soldCount' },
  { key: 'tags' },
  { key: 'seoTitle' },
  { key: 'seoDescription' },
  { key: 'createdAt' },
  { key: 'updatedAt' },
  { key: 'variantCount', value: (p) => p._count?.variants ?? 0 },
  { key: 'imageCount', value: (p) => p._count?.images ?? 0 },
];

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

    const where = args['active-only'] ? { isActive: true } : {};
    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { slug: true, name: true } },
        _count: { select: { variants: true, images: true } },
      },
      orderBy: { handle: 'asc' },
    });

    const csv = toCsv(products, COLUMNS, { escapeFormulas: args['escape-formulas'] === true });
    writeExport(args, 'products', csv);
    console.log(`[export] rows: ${products.length}${args['active-only'] ? ' (active only)' : ''}`);
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
