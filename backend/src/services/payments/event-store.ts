import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config';

/**
 * Idempotency ledger for payment webhooks.
 *
 * Stripe retries events and can deliver the same `evt_...` id more than once;
 * marking an order paid twice would be a money bug. We persist processed event
 * ids to a small JSON file (no schema change available, since
 * `schema.prisma` is off-limits) and keep an in-memory Set for fast lookups.
 *
 * Writes are serialised through a promise chain so concurrent deliveries can't
 * interleave and corrupt the file.
 */

function storePath(): string {
  const dir = path.resolve(config.upload.uploadDir);
  return path.join(dir, '.payment-events.json');
}

const processed = new Set<string>();
let loaded = false;
let writeChain: Promise<void> = Promise.resolve();

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = fs.readFileSync(storePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const id of parsed) if (typeof id === 'string') processed.add(id);
    }
  } catch {
    // First run or unreadable file - start empty.
  }
}

function flush(): void {
  load();
  const snapshot = JSON.stringify(Array.from(processed));
  writeChain = writeChain.then(async () => {
    try {
      const file = storePath();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await fs.promises.writeFile(file, snapshot, 'utf8');
    } catch (error) {
      console.error('[payments] failed to persist webhook event ledger', error);
    }
  });
}

export function isEventProcessed(eventId: string): boolean {
  load();
  return processed.has(eventId);
}

export function markEventProcessed(eventId: string): void {
  load();
  if (processed.has(eventId)) return;
  processed.add(eventId);
  flush();
}
