/**
 * Tiny argv parser for the backend/scripts CLIs.
 *
 * Supports:  --flag            (true)
 *            --key value       (string)
 *            --key=value       (string)
 *            --no-key          (false, for keys that default to true)
 *            positional args   (returned in `_`)
 *
 * Values are always strings; callers coerce. When `knownFlags` is supplied,
 * any flag outside that list is collected in `_unknown` so a typo fails loudly
 * instead of being silently ignored.
 */
export function parseArgs(argv, { booleanFlags = [], knownFlags = null } = {}) {
  const out = { _: [], _unknown: [] };
  const isKnown = (key) => !knownFlags || knownFlags.includes(key);
  let restOnly = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (restOnly) {
      out._.push(arg);
      continue;
    }
    if (arg === '--') {
      restOnly = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      out._.push(arg);
      continue;
    }

    const body = arg.slice(2);
    const eq = body.indexOf('=');

    if (eq !== -1) {
      const key = body.slice(0, eq);
      if (isKnown(key)) out[key] = body.slice(eq + 1);
      else out._unknown.push(body);
      continue;
    }

    if (body.startsWith('no-')) {
      const key = body.slice(3);
      if (isKnown(key)) out[key] = false;
      else out._unknown.push(body);
      continue;
    }

    const next = argv[i + 1];
    const looksLikeValue = next !== undefined && !next.startsWith('--');

    if (!isKnown(body)) {
      out._unknown.push(body);
      if (!booleanFlags.includes(body) && looksLikeValue) i += 1;
      continue;
    }

    if (booleanFlags.includes(body) || !looksLikeValue) {
      out[body] = true;
    } else {
      out[body] = next;
      i += 1;
    }
  }

  return out;
}

export function toInt(value, fallback, label) {
  if (value === undefined || value === null || value === true || value === '') return fallback;
  const n = Number.parseInt(String(value), 10);
  if (Number.isNaN(n) || n < 0) {
    throw new Error(`${label} must be a non-negative integer, received: ${value}`);
  }
  return n;
}
