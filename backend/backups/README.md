# Database backups

Snapshot / restore runbook for the ZiqWear SQLite store. Everything here is CLI
only - there is no HTTP route for backups, exports, or imports, and there should
not be one.

## What is where

| Path | What it is |
| --- | --- |
| `backend/prisma/ziqwear.db` | **The live store. Contains real order history.** |
| `backend/backups/` | Snapshot output of `backup-db.mjs` |
| `backend/exports/` | CSV output of the export scripts |
| `backend/scripts/backup-db.mjs` | Creates a snapshot |
| `backend/scripts/restore-db.mjs` | Installs a snapshot |

Snapshots are named `ziqwear-YYYY-MM-DD-HHmmss.db` (local time).

## Back up

From `backend/`:

```bash
npm run backup
```

Or with options:

```bash
node scripts/backup-db.mjs --keep 30
node scripts/backup-db.mjs --source prisma/ziqwear.db --dest backups --prefix ziqwear --keep 10
ZIQWEAR_BACKUP_KEEP=30 npm run backup
```

Notes:

- The snapshot uses `VACUUM INTO` over a **read-only** connection, so the source
  file is never written to and the copy is internally consistent. It is safe to
  run while the app is serving traffic.
- On Node older than 22.5 (no `node:sqlite`), the script falls back to a plain
  file copy and prints a warning. In that mode, **stop the app first**.
- Rotation (`--keep`, default 10) deletes only files matching
  `ziqwear-YYYY-MM-DD-HHmmss.db` directly inside the backup directory. It never
  touches anything else - including the `pre-restore-*` files described below,
  which are deliberately kept forever because they are often the only copy of
  the state you destroyed.
- Every snapshot is checked with `PRAGMA integrity_check` before the script
  reports success.

## Restore

**Stop the app before restoring.** A restore replaces the database file while
Node has it open; the running process keeps serving from a stale handle and will
write into the restored file afterwards. Ctrl-C `npm run dev`/`start` in the
backend first.

Step 1 - always dry run first. This is the default, and it writes nothing:

```bash
node scripts/restore-db.mjs backups/ziqwear-2026-11-03-210741.db --target prisma/ziqwear.db
```

Step 2 - rehearse against a scratch file to prove the snapshot is good:

```bash
node scripts/restore-db.mjs backups/ziqwear-2026-11-03-210741.db \
  --target ../tmp/rehearse.db --apply
```

Step 3 - restore over the live store. Three separate flags are required, and
the script refuses without them:

```bash
node scripts/restore-db.mjs backups/ziqwear-2026-11-03-210741.db \
  --target prisma/ziqwear.db \
  --i-know-this-replaces-live-data \
  --apply
```

Safety behaviour worth knowing:

- No `--target` is ever assumed. `--apply` alone refuses.
- A target named `ziqwear.db` (or the live path) additionally requires
  `--i-know-this-replaces-live-data`.
- Before touching an existing target, the script copies it to
  `backups/pre-restore-<name>-<timestamp>.db`. Suppress with
  `--no-pre-restore-backup` only if you have nowhere to fall back to.
- The script never deletes a database file. It removes only the target's stale
  `-journal` / `-wal` / `-shm` sidecars, because replaying an old WAL onto a
  restored database corrupts it.
- The restored file is re-opened and integrity-checked before the script exits 0.

## CSV export / import

```bash
npm run export:orders                    # backend/exports/orders.csv (one row per order)
npm run export:products                  # backend/exports/products.csv
npm run export:orders -- --timestamped --status PENDING,PAID
npm run import:products -- exports/products.csv            # DRY RUN, prints a plan
npm run import:products -- exports/products.csv --apply    # actually writes
```

- `import-products.csv.mjs` is **dry run unless you pass `--apply`**.
- Rows match on `handle`, falling back to `sku`. An empty cell never clears a
  value; it means "leave this field alone".
- `export:orders` contains customer PII. `backend/exports/` is git-ignored; do
  not move these files somewhere that is served or committed.
- Rehearse an import against a copy of the database by pointing
  `DATABASE_URL` at it, e.g.
  `DATABASE_URL="file:C:/full/path/to/copy.db" npm run import:products -- my.csv`.
