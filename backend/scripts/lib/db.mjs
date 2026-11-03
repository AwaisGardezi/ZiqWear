import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { BACKEND_DIR } from './paths.mjs';

/**
 * Prisma bootstrap for the ops CLIs.
 *
 * backend/.env is loaded WITHOUT overriding anything already present in the
 * environment, so an operator (or Agent C test run) can point a script at a
 * scratch database with `DATABASE_URL=... node scripts/whatever.mjs` and that
 * always wins.
 *
 * Scripts here use the generated Prisma client directly rather than
 * src/lib/prisma.ts: that module wraps the client with a JSON encode/decode
 * bridge for SQLite text columns. For CSV round-tripping we want the literal
 * stored value (e.g. Product.tags as the JSON string it is on disk), and we do
 * not want a hidden global side effect in a one-shot CLI.
 */
dotenv.config({ path: path.join(BACKEND_DIR, '.env') });

/** Absolute path of the SQLite file the current DATABASE_URL points at. */
export function resolveDbFile() {
  const url = process.env.DATABASE_URL || '';
  const match = /^file:(.+)$/.exec(url);
  if (!match) return null;
  const raw = match[1];
  if (path.isAbsolute(raw)) return raw;
  // Prisma resolves relative `file:` URLs against the schema directory.
  return path.resolve(BACKEND_DIR, 'prisma', raw);
}

export function describeDb() {
  const file = resolveDbFile();
  return file ? path.relative(process.cwd(), file) || file : process.env.DATABASE_URL || '(unset)';
}

export function createPrisma() {
  const file = resolveDbFile();
  if (file && !fs.existsSync(file)) {
    throw new Error(
      `DATABASE_URL points at "${file}", which does not exist.\n` +
        'Set DATABASE_URL (absolute file: URL is safest) or run the script from a ' +
        'checkout that has the database.',
    );
  }
  return new PrismaClient({ log: ['error'] });
}
