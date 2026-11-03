import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Shared filesystem constants for the ZiqWear ops CLIs in backend/scripts/.
 * Everything is resolved from this file's location so the scripts behave the
 * same no matter which directory npm was invoked from.
 */

export const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_DIR = path.resolve(SCRIPTS_DIR, '..', '..');
export const REPO_ROOT = path.resolve(BACKEND_DIR, '..');

/** The production data file. Read-only for every script in this folder. */
export const LIVE_DB = path.join(BACKEND_DIR, 'prisma', 'ziqwear.db');
export const BACKUP_DIR = path.join(BACKEND_DIR, 'backups');
export const EXPORT_DIR = path.join(BACKEND_DIR, 'exports');

/** First 16 bytes of every SQLite database file. */
export const SQLITE_MAGIC = 'SQLite format 3\0';

/**
 * Local-time snapshot stamp: YYYY-MM-DD-HHmmss.
 * Local (not UTC) on purpose - the ops runbook matches the operator's clock.
 */
export function timestamp(date = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return [
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`,
    `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`,
  ].join('-');
}

/** True when `file` exists and is a regular file. */
export function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * Validate that `file` looks like a SQLite database before any script touches
 * it. Throws with a clear message instead of producing a useless snapshot.
 */
export function assertSqliteFile(file, label = file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(SQLITE_MAGIC.length);
    const read = fs.readSync(fd, buf, 0, buf.length, 0);
    if (read !== buf.length || buf.toString('latin1') !== SQLITE_MAGIC) {
      throw new Error(`${label} is not a SQLite database (bad magic header).`);
    }
  } finally {
    fs.closeSync(fd);
  }
}

/** Does `target` point at the live order-history database? */
export function isLiveDb(target) {
  return path.resolve(target) === path.resolve(LIVE_DB);
}

export function relativeToBackend(file) {
  const rel = path.relative(BACKEND_DIR, file);
  return rel && !rel.startsWith('..') ? rel.split(path.sep).join('/') : file;
}
