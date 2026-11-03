#!/usr/bin/env node
/**
 * backup-db.mjs - snapshot the ZiqWear SQLite database into backend/backups/.
 *
 * HOW IT SNAPSHOTS
 *   Preferred: `VACUUM INTO`. The source is opened with node:sqlite in readOnly
 *   mode, so the engine physically cannot write to it, and SQLite produces a
 *   fresh, defragmented, transactionally consistent copy at the destination.
 *   Safe to run while the app is live.
 *   Fallback: `fs.copyFileSync`, used only when `node:sqlite` is unavailable.
 *   A raw copy of a busy database can catch a half-committed page, so the
 *   fallback warns and also copies any -journal/-wal/-shm sidecars.
 *
 * WHY node:sqlite AND NOT better-sqlite3
 *   backend/package.json has no SQLite driver dependency (Prisma ships a native
 *   query engine that is not callable from JS), so `VACUUM INTO` is done through
 *   Node's built-in `node:sqlite` (added in Node 22.5, no flag needed on the
 *   Node 24 this project runs). NO NEW RUNTIME DEPENDENCY WAS ADDED. If a
 *   driver such as better-sqlite3 is ever added to backend/package.json, the
 *   vacuumInto() helper below is where it would slot in; the copy fallback is
 *   already correct without one.
 *
 * SAFETY GUARANTEES
 *   - never writes to, truncates, or deletes the source file
 *   - refuses to run when the source is missing or is not a SQLite file
 *   - refuses when the snapshot would land on top of the source
 *   - rotation deletes ONLY files matching <prefix>-YYYY-MM-DD-HHmmss[-N].db
 *     directly inside the backup directory; nothing else is ever removed
 *
 * USAGE
 *   node backend/scripts/backup-db.mjs [options]
 *   npm run backup                        (from backend/)
 *
 * OPTIONS
 *   --source <path>   database to snapshot (env ZIQWEAR_DB_SOURCE;
 *                     default backend/prisma/ziqwear.db)
 *   --dest <dir>      output directory     (env ZIQWEAR_BACKUP_DIR;
 *                     default backend/backups)
 *   --prefix <name>   snapshot basename    (default "ziqwear")
 *   --keep <N>        snapshots to retain   (env ZIQWEAR_BACKUP_KEEP; default 10)
 *   --no-verify       skip PRAGMA integrity_check on the new snapshot
 *   --help            show this help
 *
 * EXIT CODES
 *   0  snapshot written
 *   1  refused or failed (source missing, not a database, write/verify error)
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseArgs, toInt } from './lib/cli.mjs';
import {
  BACKUP_DIR,
  LIVE_DB,
  SQLITE_MAGIC,
  assertSqliteFile,
  isFile,
  relativeToBackend,
  timestamp,
} from './lib/paths.mjs';

const require = createRequire(import.meta.url);

const BOOLEAN_FLAGS = ['verify', 'help'];
const KNOWN_FLAGS = ['source', 'dest', 'prefix', 'keep', 'verify', 'help'];

const USAGE = [
  'Usage: node backend/scripts/backup-db.mjs [options]',
  '',
  'Snapshots a SQLite database into backend/backups/ as',
  '<prefix>-YYYY-MM-DD-HHmmss.db using VACUUM INTO over a read-only',
  'connection (falls back to a plain file copy on Node < 22.5).',
  'The source file is never modified.',
  '',
  '  --source <path>   database to snapshot (env ZIQWEAR_DB_SOURCE;',
  '                    default backend/prisma/ziqwear.db)',
  '  --dest <dir>      output directory     (env ZIQWEAR_BACKUP_DIR;',
  '                    default backend/backups)',
  '  --prefix <name>   snapshot basename    (default: ziqwear)',
  '  --keep <N>        snapshots to retain  (env ZIQWEAR_BACKUP_KEEP; default 10)',
  '  --no-verify       skip PRAGMA integrity_check on the new snapshot',
  '  --help            show this message',
  '',
  'Examples:',
  '  npm run backup',
  '  npm run backup -- --keep 30',
  '  node scripts/backup-db.mjs --source ../tmp/check.db --dest ../backups --keep 2',
].join('\n');

function help() {
  console.log(USAGE);
}

function fail(message) {
  console.error(`[backup] REFUSED: ${message}`);
  return 1;
}

/** node:sqlite is optional at runtime: absent before Node 22.5. */
function loadSqlite() {
  try {
    const mod = require('node:sqlite');
    return mod && typeof mod.DatabaseSync === 'function' ? mod : null;
  } catch {
    return null;
  }
}

function vacuumInto(sqlite, source, dest) {
  const db = new sqlite.DatabaseSync(source, { readOnly: true });
  try {
    db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
}

function copyFallback(source, dest) {
  fs.copyFileSync(source, dest);
  const sidecars = [];
  for (const suffix of ['-journal', '-wal', '-shm']) {
    if (isFile(`${source}${suffix}`)) {
      fs.copyFileSync(`${source}${suffix}`, `${dest}${suffix}`);
      sidecars.push(path.basename(`${dest}${suffix}`));
    }
  }
  return sidecars;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Exactly what this script writes - and nothing else. */
function snapshotPattern(prefix) {
  return new RegExp(`^${escapeRegExp(prefix)}-\\d{4}-\\d{2}-\\d{2}-\\d{6}(-\\d+)?\\.db$`);
}

function pruneOldSnapshots(dir, prefix, keep) {
  const re = snapshotPattern(prefix);
  const names = fs.readdirSync(dir).filter((n) => re.test(n)).sort();
  const removable = names.length - keep;

  if (removable <= 0) {
    console.log(`[backup] rotation: ${names.length} snapshot(s) held, keeping the newest ${keep}.`);
    return;
  }

  let removed = 0;
  for (const name of names.slice(0, removable)) {
    if (!re.test(name)) continue; // belt and braces before unlink
    fs.rmSync(path.join(dir, name), { force: true });
    for (const suffix of ['-journal', '-wal', '-shm']) {
      fs.rmSync(path.join(dir, `${name}${suffix}`), { force: true });
    }
    removed += 1;
    console.log(`[backup] rotation: removed ${name}`);
  }
  console.log(`[backup] rotation: ${removed} old snapshot(s) deleted, ${keep} retained.`);
}

function verifySnapshot(file, sqlite) {
  const size = fs.statSync(file).size;
  if (size < SQLITE_MAGIC.length) throw new Error('snapshot is empty');
  assertSqliteFile(file, 'snapshot');
  if (!sqlite) return { size, integrity: 'header ok (integrity_check skipped: node:sqlite unavailable)' };

  const db = new sqlite.DatabaseSync(file, { readOnly: true });
  try {
    const row = db.prepare('PRAGMA integrity_check').get();
    const verdict = row ? Object.values(row)[0] : null;
    if (verdict !== 'ok') throw new Error(`PRAGMA integrity_check reported: ${verdict}`);
    return { size, integrity: 'ok' };
  } finally {
    db.close();
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    booleanFlags: BOOLEAN_FLAGS,
    knownFlags: KNOWN_FLAGS,
  });

  if (args.help) {
    help();
    return 0;
  }
  if (args._unknown.length) return fail(`unknown option(s): ${args._unknown.map((f) => `--${f}`).join(', ')}`);
  if (args._.length) return fail(`unexpected positional argument(s): ${args._.join(' ')}`);

  const source = path.resolve(args.source || process.env.ZIQWEAR_DB_SOURCE || LIVE_DB);
  const destDir = path.resolve(args.dest || process.env.ZIQWEAR_BACKUP_DIR || BACKUP_DIR);
  const prefix = String(args.prefix || 'ziqwear');
  const keep = toInt(
    args.keep !== undefined ? args.keep : process.env.ZIQWEAR_BACKUP_KEEP,
    10,
    '--keep',
  );
  const shouldVerify = args.verify !== false;

  if (!isFile(source)) {
    return fail(
      `source database not found: ${source}. Pass --source <path> or set ` +
        'ZIQWEAR_DB_SOURCE. Nothing was written.',
    );
  }
  try {
    assertSqliteFile(source, 'source');
  } catch (err) {
    return fail(err.message);
  }

  const sqlite = loadSqlite();
  if (!sqlite) {
    console.warn(
      '[backup] WARNING: node:sqlite is unavailable on this Node. Using a plain ' +
        'file copy - stop the app before backing up for a guaranteed-consistent snapshot.',
    );
  }

  fs.mkdirSync(destDir, { recursive: true });

  const dest = path.join(destDir, `${prefix}-${timestamp()}.db`);
  if (path.resolve(dest) === path.resolve(source)) {
    return fail('the snapshot would overwrite the source database; refusing.');
  }
  if (fs.existsSync(dest)) {
    console.warn(`[backup] same-second collision, replacing ${path.basename(dest)}`);
    fs.rmSync(dest);
  }

  const before = fs.statSync(source);
  let sidecars = [];
  try {
    if (sqlite) vacuumInto(sqlite, source, dest);
    else sidecars = copyFallback(source, dest);
  } catch (err) {
    fs.rmSync(dest, { force: true });
    for (const s of sidecars) fs.rmSync(path.join(destDir, s), { force: true });
    return fail(`snapshot failed: ${err.message}`);
  }

  const after = fs.statSync(source);
  if (before.mtimeMs !== after.mtimeMs || before.size !== after.size) {
    console.warn(
      '[backup] NOTE: the source was written to while snapshotting (normal for a ' +
        'live store; the snapshot itself is still internally consistent).',
    );
  }

  let report = { size: fs.statSync(dest).size, integrity: 'skipped (--no-verify)' };
  if (shouldVerify) {
    try {
      report = verifySnapshot(dest, sqlite);
    } catch (err) {
      return fail(`the snapshot did not verify: ${err.message} (kept for inspection at ${dest})`);
    }
  }

  console.log(`[backup] method:    ${sqlite ? 'VACUUM INTO (read-only connection)' : 'fs.copyFileSync'}`);
  console.log(`[backup] source:    ${relativeToBackend(source)} (${after.size} bytes, untouched)`);
  console.log(`[backup] snapshot:  ${relativeToBackend(dest)} (${report.size} bytes)`);
  console.log(`[backup] integrity: ${report.integrity}`);
  if (sidecars.length) console.log(`[backup] sidecars:  ${sidecars.join(', ')}`);

  pruneOldSnapshots(destDir, prefix, keep);
  console.log('[backup] done.');
  return 0;
}

try {
  process.exitCode = main();
} catch (err) {
  console.error(`[backup] FAILED: ${err.message}`);
  process.exitCode = 1;
}
