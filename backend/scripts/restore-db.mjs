#!/usr/bin/env node
/**
 * restore-db.mjs - install a snapshot produced by backup-db.mjs as a database.
 *
 * SAFETY MODEL (three gates, all required to actually write):
 *   1. DRY RUN IS THE DEFAULT. With no --apply the script only prints what it
 *      would do and writes nothing. `--dry-run` is accepted as an explicit no.
 *   2. --target <path> must be given explicitly. There is no implicit target,
 *      so a bare `node restore-db.mjs <snapshot>` can never hit a live file.
 *   3. Overwriting the live store (backend/prisma/ziqwear.db, or any file whose
 *      basename is ziqwear.db) additionally requires
 *      --i-know-this-replaces-live-data.
 *
 * This script never deletes a database file. On --apply it first writes a
 * pre-restore safety copy of the current target into backend/backups/ (disable
 * with --no-pre-restore-backup), then overwrites the target in place. Only the
 * stale SQLite sidecar files of the target (-journal/-wal/-shm) are removed,
 * because replaying an old WAL onto a restored database corrupts it.
 *
 * USAGE
 *   node backend/scripts/restore-db.mjs <snapshot.db> [options]
 *
 * OPTIONS
 *   <snapshot.db>          snapshot to restore (positional, or --from <path>)
 *   --target <path>        where to write it (required with --apply)
 *   --apply                actually write; without this nothing changes
 *   --dry-run              explicit no-op (this is already the default)
 *   --i-know-this-replaces-live-data
 *                          required extra gate when the target is the live
 *                          ziqwear.db
 *   --no-pre-restore-backup
 *                          skip the automatic safety copy of the current target
 *   --help                 show this message
 *
 * EXIT CODES
 *   0  dry run completed, or restore applied and verified
 *   1  refused or failed - nothing was written
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseArgs } from './lib/cli.mjs';
import {
  BACKUP_DIR,
  LIVE_DB,
  assertSqliteFile,
  isFile,
  relativeToBackend,
  timestamp,
} from './lib/paths.mjs';

const require = createRequire(import.meta.url);

const BOOLEAN_FLAGS = ['apply', 'dry-run', 'i-know-this-replaces-live-data', 'pre-restore-backup', 'help'];
const KNOWN_FLAGS = ['from', 'target', ...BOOLEAN_FLAGS];
const SIDECAR_SUFFIXES = ['-journal', '-wal', '-shm'];

const USAGE = [
  'Usage: node backend/scripts/restore-db.mjs <snapshot.db> [--target <path>] [--apply] [...]',
  '',
  'Defaults to a DRY RUN: nothing is written unless --apply is passed.',
  'Restoring over the live store additionally requires',
  '--i-know-this-replaces-live-data.',
  '',
  '  <snapshot.db>         snapshot to restore (or --from <path>)',
  '  --target <path>       destination database (required with --apply)',
  '  --apply               perform the write',
  '  --dry-run             explicit no-op (already the default)',
  '  --i-know-this-replaces-live-data',
  '                        extra confirmation gate for the live ziqwear.db',
  '  --no-pre-restore-backup',
  '                        skip the safety copy of the current target',
  '  --help                show this message',
  '',
  'Examples:',
  '  node scripts/restore-db.mjs backups/ziqwear-2026-11-03-210741.db',
  '  node scripts/restore-db.mjs backups/...db --target ../tmp/rehearse.db --apply',
  '  npm run restore -- --from backups/...db --target prisma/ziqwear.db \\',
  '      --i-know-this-replaces-live-data --apply   (app must be STOPPED)',
].join('\n');

function loadSqlite() {
  try {
    const mod = require('node:sqlite');
    return mod && typeof mod.DatabaseSync === 'function' ? mod : null;
  } catch {
    return null;
  }
}

function checkIntegrity(file, sqlite, label) {
  if (!isFile(file)) throw new Error(`${label} is missing: ${file}`);
  assertSqliteFile(file, label);
  if (!sqlite) return 'header ok (integrity_check skipped: node:sqlite unavailable)';
  const db = new sqlite.DatabaseSync(file, { readOnly: true });
  try {
    const row = db.prepare('PRAGMA integrity_check').get();
    const verdict = row ? Object.values(row)[0] : null;
    if (verdict !== 'ok') throw new Error(`${label} PRAGMA integrity_check reported: ${verdict}`);
    return 'ok';
  } finally {
    db.close();
  }
}

function refusesToTouchLive(target) {
  const resolved = path.resolve(target);
  if (resolved === path.resolve(LIVE_DB)) return true;
  // Also catch a live file reached through a different path spelling.
  return path.basename(resolved).toLowerCase() === 'ziqwear.db';
}

function fail(message) {
  console.error(`[restore] REFUSED: ${message}`);
  return 1;
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    booleanFlags: BOOLEAN_FLAGS,
    knownFlags: KNOWN_FLAGS,
  });

  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if (args._unknown.length) {
    return fail(`unknown option(s): ${args._unknown.map((f) => `--${f}`).join(', ')}`);
  }
  const snapshotArg = typeof args.from === 'string' ? args.from : args._[0];
  if (typeof args.from === 'string' && args._.length) {
    return fail('give the snapshot either as a positional argument or via --from, not both.');
  }
  if (args._.length > 1) {
    return fail(`expected one snapshot argument, got: ${args._.join(' ')}`);
  }
  if (!snapshotArg) {
    return fail('no snapshot given. Usage: restore-db.mjs <snapshot.db> [--target <path>] [--apply]');
  }

  const snapshot = path.resolve(snapshotArg);
  if (!isFile(snapshot)) return fail(`snapshot not found: ${snapshot}`);

  const sqlite = loadSqlite();
  let snapshotIntegrity;
  try {
    snapshotIntegrity = checkIntegrity(snapshot, sqlite, 'snapshot');
  } catch (err) {
    return fail(err.message);
  }

  if (args.apply === true && args['dry-run'] === true) {
    return fail('--apply and --dry-run contradict each other; pass exactly one.');
  }
  const apply = args.apply === true;
  const hasTarget = typeof args.target === 'string' && args.target.length > 0;
  const target = hasTarget ? path.resolve(args.target) : null;
  const liveOverrideAck = args['i-know-this-replaces-live-data'] === true;
  const preRestoreBackup = args['pre-restore-backup'] !== false;

  if (apply && !target) {
    return fail(
      '--apply requires an explicit --target <path>. Nothing was written. ' +
        '(A bare --apply is intentionally not enough to hit a database.)',
    );
  }
  if (target && path.resolve(target) === path.resolve(snapshot)) {
    return fail('the target resolves to the snapshot itself; refusing.');
  }
  if (apply && target && refusesToTouchLive(target) && !liveOverrideAck) {
    return fail(
      `${relativeToBackend(target)} is the live store and holds real order history.\n` +
        '         Add --i-know-this-replaces-live-data to overwrite it, and stop the\n' +
        '         app first. Rehearse against a scratch --target instead.',
    );
  }

  const targetExists = target ? isFile(target) : false;
  const targetSize = targetExists ? fs.statSync(target).size : 0;
  const snapshotSize = fs.statSync(snapshot).size;

  console.log('[restore] snapshot:  ' + relativeToBackend(snapshot) + ` (${snapshotSize} bytes)`);
  console.log(`[restore] integrity: ${snapshotIntegrity}`);
  console.log(`[restore] target:    ${target ? relativeToBackend(target) : '(none given)'}${targetExists ? ` (${targetSize} bytes, will be replaced)` : target ? ' (does not exist yet)' : ''}`);
  console.log(`[restore] mode:      ${apply ? 'APPLY' : 'DRY RUN (no writes)'}`);

  if (!apply) {
    console.log('');
    console.log('[restore] Would do the following:');
    if (targetExists && preRestoreBackup) {
      console.log(`[restore]   1. copy ${path.basename(target)} -> backups/pre-restore-<now>.db`);
    }
    console.log(`[restore]   ${targetExists && preRestoreBackup ? '2' : '1'}. write the snapshot over ${target ? relativeToBackend(target) : '(no target)'}`);
    console.log('[restore]   next. remove stale -journal/-wal/-shm sidecars of the target');
    console.log('[restore]   next. re-open the target and run PRAGMA integrity_check');
    console.log('');
    console.log('[restore] Nothing was changed. Re-run with --apply (and --target) to restore.');
    return 0;
  }

  // ---- APPLY ------------------------------------------------------------
  try {
    if (targetExists && preRestoreBackup) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const safety = path.join(
        BACKUP_DIR,
        `pre-restore-${path.basename(target, path.extname(target))}-${timestamp()}.db`,
      );
      fs.copyFileSync(target, safety);
      for (const suffix of SIDECAR_SUFFIXES) {
        if (isFile(`${target}${suffix}`)) fs.copyFileSync(`${target}${suffix}`, `${safety}${suffix}`);
      }
      console.log(`[restore] safety copy of the current target: ${relativeToBackend(safety)}`);
    }

    const staging = `${target}.agentc-restoring.tmp`;
    if (fs.existsSync(staging)) fs.rmSync(staging);
    fs.copyFileSync(snapshot, staging);
    checkIntegrity(staging, sqlite, 'staged copy');
    fs.copyFileSync(staging, target);
    fs.rmSync(staging, { force: true });

    for (const suffix of SIDECAR_SUFFIXES) fs.rmSync(`${target}${suffix}`, { force: true });

    const verdict = checkIntegrity(target, sqlite, 'restored target');
    console.log(`[restore] restored ${relativeToBackend(target)} (${fs.statSync(target).size} bytes, integrity ${verdict})`);
    console.log('[restore] Reminder: start the app and spot-check the orders screen.');
    return 0;
  } catch (err) {
    console.error(`[restore] FAILED: ${err.message}`);
    return 1;
  }
}

process.exitCode = main();
