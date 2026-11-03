import fs from 'node:fs';
import path from 'node:path';
import { EXPORT_DIR, relativeToBackend, timestamp } from './paths.mjs';
import { parseArgs } from './cli.mjs';

/**
 * Resolve the --out / --dest-dir / --timestamped / --escape-formulas options
 * shared by the export CLIs, and write the rendered CSV.
 */
export const EXPORT_COMMON_FLAGS = ['out', 'dest-dir', 'prefix', 'help'];
export const EXPORT_BOOLEAN_FLAGS = ['timestamped', 'escape-formulas', 'help'];

export function resolveExportTarget(args, defaultPrefix) {
  const prefix = String(args.prefix || defaultPrefix);
  const destDir = path.resolve(args['dest-dir'] || process.env.ZIQWEAR_EXPORT_DIR || EXPORT_DIR);

  if (typeof args.out === 'string' && args.out.length) {
    return { file: path.resolve(args.out), explicit: true };
  }
  const name = args.timestamped ? `${prefix}-${timestamp()}.csv` : `${prefix}.csv`;
  return { file: path.join(destDir, name), explicit: false, destDir };
}

export function writeExport(args, defaultPrefix, csv) {
  const { file, explicit, destDir } = resolveExportTarget(args, defaultPrefix);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!explicit) fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(file, csv, 'utf8');
  const bytes = fs.statSync(file).size;
  console.log(`[export] wrote ${relativeToBackend(file)} (${bytes} bytes)`);
  return file;
}

export function reportUnknown(args) {
  if (args._unknown.length) {
    throw new Error(`unknown option(s): ${args._unknown.map((f) => `--${f}`).join(', ')}`);
  }
  if (args._.length) {
    throw new Error(`unexpected positional argument(s): ${args._.join(' ')}`);
  }
}
