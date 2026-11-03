#!/usr/bin/env node
/**
 * import-products.csv.mjs - upsert products from a CSV export (or a spreadsheet
 * an operator edited by hand).
 *
 * SAFETY MODEL
 *   DRY RUN IS THE DEFAULT. Running this script with no --apply flag reads the
 *   CSV, validates every row, prints the plan and writes NOTHING. Add --apply
 *   to actually write. --dry-run is accepted as an explicit no-op.
 *   Pass --apply and --dry-run together and the script refuses.
 *
 * MATCHING
 *   Rows are matched on `handle` (unique). If the CSV has no handle column, or
 *   the cell is empty, `sku` (also unique) is used instead. A matched row is
 *   UPDATED, an unmatched row is CREATED.
 *
 * EMPTY CELL SEMANTICS
 *   An empty cell never clears a value. On update it means "leave this field
 *   alone"; on create it means "use the schema default". Blanking a field is
 *   not supported from the CLI on purpose - use the admin UI for that, so a
 *   stray empty column in a spreadsheet cannot silently wipe descriptions.
 *
 * COLUMNS THAT ARE READ-ONLY AND IGNORED
 *   id, createdAt, updatedAt, variantCount, imageCount, categoryName. Product.id
 *   is a cuid and timestamps are managed by Prisma; the counts and
 *   categoryName come from relations a product import cannot own.
 *
 * CATEGORY
 *   Create requires a category. Supply `categorySlug` (resolved against the
 *   Category table) or `categoryId`. An unknown slug fails the row rather than
 *   creating an orphan.
 *
 * tags
 *   Accepts the JSON-array text the exporter emits (["a","b"]) or a plain
 *   comma-separated list (a, b). Both are stored as the JSON string SQLite
 *   holds, which is what src/lib/prisma.ts expects to parse back into an array.
 *
 * USAGE
 *   node backend/scripts/import-products.csv.mjs <file.csv> [--apply]
 *   npm run import:products -- --file backend/exports/products.csv --apply
 *
 * OPTIONS
 *   <file.csv>         CSV to import (positional, or --file <path>)
 *   --apply            write to the database (default is dry run)
 *   --dry-run          explicit no-op (already the default)
 *   --column-handle <name>  override the handle column name (default "handle")
 *   --column-sku <name>     override the sku column name   (default "sku")
 *   --help             show this message
 *
 * EXIT CODES
 *   0  every row planned/written (individual rejected rows are reported as skips)
 *   1  fatal: unreadable CSV, malformed columns, or a database write error
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './lib/cli.mjs';
import { parseCsvWithHeaders } from './lib/csv.mjs';
import { createPrisma, describeDb } from './lib/db.mjs';

const BOOLEAN_FLAGS = ['apply', 'dry-run', 'help'];
const KNOWN_FLAGS = ['file', 'apply', 'dry-run', 'column-handle', 'column-sku', 'help'];

const USAGE = [
  'Usage: node backend/scripts/import-products.csv.mjs <file.csv> [--apply]',
  '',
  'DRY RUN BY DEFAULT - nothing is written unless --apply is passed.',
  'Rows are matched on handle, falling back to sku. An empty cell never',
  'clears an existing value.',
  '',
  '  <file.csv>              CSV to import (or --file <path>)',
  '  --apply                 actually write',
  '  --dry-run               explicit no-op (already the default)',
  '  --column-handle <name>  handle column name (default: handle)',
  '  --column-sku <name>     sku column name (default: sku)',
  '  --help                  show this message',
  '',
  'Env: DATABASE_URL selects the database. Rehearse against a copy first.',
].join('\n');

const IGNORED_COLUMNS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'variantCount',
  'imageCount',
  'categoryName',
  'categorySlug', // consumed to resolve categoryId, never written directly
  'categoryId',
  '__record',
]);

const TEXT_FIELDS = [
  'title',
  'description',
  'shortDescription',
  'sku',
  'barcode',
  'fabric',
  'fit',
  'careInstructions',
  'seoTitle',
  'seoDescription',
  'weightUnit',
  'handle',
];
const INT_FIELDS = ['gsm', 'limitedEditionNumber', 'limitedEditionTotal', 'soldCount'];
const DECIMAL_FIELDS = ['basePrice', 'compareAtPrice', 'costPrice', 'weight'];
const BOOL_FIELDS = ['isActive', 'isFeatured', 'isNewArrival', 'isBestseller', 'isLimitedEdition'];
const DATE_FIELDS = ['launchDate'];
const JSON_FIELDS = ['tags'];

/** Required only when the row creates a new product. */
const REQUIRED_ON_CREATE = ['title', 'description', 'sku', 'basePrice', 'categoryId'];

const TRUTHY = new Set(['true', '1', 'yes', 'y', 'on']);
const FALSY = new Set(['false', '0', 'no', 'n', 'off']);
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

class RowError extends Error {}

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function blank(cell) {
  return cell === undefined || cell === null || String(cell).trim() === '';
}

function coerceTags(raw) {
  const text = String(raw).trim();
  if (text.startsWith('[')) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new RowError(`tags is not valid JSON array text: ${text}`);
    }
    if (!Array.isArray(parsed)) throw new RowError(`tags must be a JSON array: ${text}`);
    return JSON.stringify(parsed.map((t) => String(t)));
  }
  return JSON.stringify(
    text
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  );
}

/**
 * Turn one CSV record into { data, categoryId, errors }.
 * `existing` is the matched Product row or null (null = this will be a create).
 * Async because a category slug has to be resolved against the database.
 */
async function buildProductData(record, existing, categoryCache, prisma) {
  const isCreate = existing === null;
  const data = {};
  const errors = [];
  let categoryId = null;

  const setField = (name, value) => {
    data[name] = value;
  };

  for (const name of TEXT_FIELDS) {
    if (IGNORED_COLUMNS.has(name) && name !== 'handle') continue;
    const cell = record[name];
    if (blank(cell)) continue; // empty never clears
    setField(name, String(cell));
  }

  for (const name of INT_FIELDS) {
    const cell = record[name];
    if (blank(cell)) continue;
    const text = String(cell).trim();
    if (!/^-?\d+$/.test(text)) {
      errors.push(`${name} must be a whole number, got "${text}"`);
      continue;
    }
    setField(name, Number.parseInt(text, 10));
  }

  for (const name of DECIMAL_FIELDS) {
    const cell = record[name];
    if (blank(cell)) continue;
    const text = String(cell).trim();
    if (!NUMBER_RE.test(text)) {
      errors.push(`${name} must be a number, got "${text}"`);
      continue;
    }
    // Prisma accepts a string for Decimal; pass through to avoid float drift.
    setField(name, text);
  }

  for (const name of BOOL_FIELDS) {
    const cell = record[name];
    if (blank(cell)) continue;
    const text = String(cell).trim().toLowerCase();
    if (TRUTHY.has(text)) setField(name, true);
    else if (FALSY.has(text)) setField(name, false);
    else errors.push(`${name} must be true/false, got "${text}"`);
  }

  for (const name of DATE_FIELDS) {
    const cell = record[name];
    if (blank(cell)) continue;
    const d = new Date(String(cell).trim());
    if (Number.isNaN(d.getTime())) errors.push(`${name} is not a date, got "${cell}"`);
    else setField(name, d);
  }

  for (const name of JSON_FIELDS) {
    const cell = record[name];
    if (blank(cell)) continue;
    try {
      setField(name, coerceTags(cell));
    } catch (err) {
      errors.push(err.message);
    }
  }

  // Category: slug wins over a raw id.
  const slugCell = record.categorySlug;
  const idCell = record.categoryId;
  if (!blank(slugCell)) {
    const slug = String(slugCell).trim();
    if (!categoryCache.has(slug)) {
      categoryCache.set(slug, prisma.category.findUnique({ where: { slug } }));
    }
    // The cache holds the in-flight promise so a repeated slug is fetched once.
    const category = await categoryCache.get(slug);
    if (!category) errors.push(`categorySlug "${slug}" does not exist`);
    else categoryId = category.id;
  } else if (!blank(idCell)) {
    categoryId = String(idCell).trim();
  }

  if (categoryId) data.categoryId = categoryId;

  if (isCreate) {
    for (const required of REQUIRED_ON_CREATE) {
      const resolved = required === 'categoryId' ? categoryId : data[required];
      if (blank(resolved)) errors.push(`${required} is required to create a product`);
    }
    if (!data.handle) {
      const seed = data.handle || data.sku || data.title;
      if (!blank(seed)) data.handle = slugify(seed);
    }
  }

  return { data, categoryId, errors };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleanFlags: BOOLEAN_FLAGS, knownFlags: KNOWN_FLAGS });

  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if (args._unknown.length) {
    throw new Error(`unknown option(s): ${args._unknown.map((f) => `--${f}`).join(', ')}`);
  }
  if (args.apply === true && args['dry-run'] === true) {
    throw new Error('--apply and --dry-run contradict each other; pass exactly one.');
  }
  if (args._.length > 1 && !args.file) throw new Error(`expected one CSV path, got: ${args._.join(' ')}`);

  const csvArg = typeof args.file === 'string' ? args.file : args._[0];
  if (!csvArg) throw new Error('no CSV given. Usage: import-products.csv.mjs <file.csv> [--apply]');
  const csvPath = path.resolve(csvArg);
  if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);

  const apply = args.apply === true;
  const handleColumn = typeof args['column-handle'] === 'string' ? args['column-handle'] : 'handle';
  const skuColumn = typeof args['column-sku'] === 'string' ? args['column-sku'] : 'sku';

  const { headers, records, errors: structuralErrors } = parseCsvWithHeaders(
    fs.readFileSync(csvPath, 'utf8'),
  );

  console.log(`[import] csv:      ${csvPath}`);
  console.log(`[import] columns:  ${headers.length}, rows: ${records.length}`);
  console.log(`[import] database: ${describeDb()}`);
  console.log(`[import] mode:     ${apply ? 'APPLY (writes will happen)' : 'DRY RUN (no writes)'}`);

  if (structuralErrors.length) {
    for (const e of structuralErrors) console.error(`[import] MALFORMED: ${e}`);
    throw new Error(`${structuralErrors.length} malformed row(s): fix the CSV before importing.`);
  }
  if (records.length === 0) {
    console.warn('[import] the CSV has no data rows; nothing to do.');
    return 0;
  }

  const canMatch = headers.includes(handleColumn) || headers.includes(skuColumn);
  if (!canMatch) {
    throw new Error(
      `the CSV must contain a "${handleColumn}" or "${skuColumn}" column to match rows on.`,
    );
  }
  if (!headers.includes('title')) {
    console.warn(`[import] WARNING: no "title" column; created rows will be rejected.`);
  }

  const prisma = createPrisma();
  const categoryCache = new Map();
  const plannedHandles = new Set();
  const plannedSkus = new Set();

  const summary = { create: 0, update: 0, skip: 0, written: 0 };
  const skips = [];

  try {
    for (const record of records) {
      const recordNo = record.__record;
      const handleCell = record[handleColumn];
      const skuCell = record[skuColumn];
      const handleValue = blank(handleCell) ? null : String(handleCell).trim();
      const skuValue = blank(skuCell) ? null : String(skuCell).trim();

      if (!handleValue && !skuValue) {
        summary.skip += 1;
        skips.push(`record ${recordNo}: no ${handleColumn} and no ${skuColumn} to match on`);
        continue;
      }

      // Reject duplicates inside the file rather than letting the last row win.
      const dupKey = handleValue ? `h:${handleValue}` : `s:${skuValue}`;
      if (plannedHandles.has(dupKey) || (skuValue && plannedSkus.has(`s:${skuValue}`))) {
        summary.skip += 1;
        skips.push(`record ${recordNo}: duplicate ${handleValue ? handleColumn : skuColumn} "${handleValue || skuValue}" in this file`);
        continue;
      }
      if (skuValue) plannedSkus.add(`s:${skuValue}`);
      if (handleValue) plannedHandles.add(`h:${handleValue}`);

      let existing = null;
      if (handleValue) {
        existing = await prisma.product.findUnique({
          where: { handle: handleValue },
          select: { id: true, handle: true, sku: true },
        });
        if (!existing && skuValue) {
          // Handle is new but the sku may already belong to another product.
          const skuOwner = await prisma.product.findUnique({
            where: { sku: skuValue },
            select: { id: true, handle: true },
          });
          if (skuOwner) {
            summary.skip += 1;
            skips.push(
              `record ${recordNo}: sku "${skuValue}" already belongs to handle "${skuOwner.handle}"`,
            );
            continue;
          }
        }
      } else {
        existing = await prisma.product.findUnique({
          where: { sku: skuValue },
          select: { id: true, handle: true, sku: true },
        });
      }

      const { data, errors } = await buildProductData(record, existing, categoryCache, prisma);
      if (errors.length) {
        summary.skip += 1;
        skips.push(`record ${recordNo}: ${errors.join('; ')}`);
        continue;
      }

      if (existing) {
        const changed = Object.keys(data).filter((key) => key !== 'handle');
        if (changed.length === 0) {
          summary.skip += 1;
          skips.push(`record ${recordNo}: only the handle is present for "${existing.handle}", nothing to change`);
          continue;
        }
        summary.update += 1;
        console.log(`[import] UPDATE ${existing.handle} (record ${recordNo}): ${changed.join(', ')}`);
        if (apply) {
          await prisma.product.update({ where: { id: existing.id }, data });
          summary.written += 1;
        }
      } else {
        if (!data.handle) {
          summary.skip += 1;
          skips.push(`record ${recordNo}: could not derive a handle from sku/title`);
          continue;
        }
        summary.create += 1;
        console.log(`[import] CREATE ${data.handle} (record ${recordNo})`);
        if (apply) {
          await prisma.product.create({ data });
          summary.written += 1;
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log('');
  for (const s of skips) console.log(`[import] SKIP: ${s}`);
  console.log('');
  console.log(`[import] SUMMARY  created=${apply ? summary.create : `${summary.create} (planned)`}  updated=${apply ? summary.update : `${summary.update} (planned)`}  skipped=${summary.skip}`);
  if (!apply) {
    console.log('[import] DRY RUN complete - the database was not modified.');
    console.log('[import] Re-run with --apply to write these changes.');
  } else {
    console.log(`[import] Wrote ${summary.written} row(s) to ${describeDb()}.`);
  }
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(`[import] FAILED: ${err.message}`);
    process.exitCode = 1;
  });
