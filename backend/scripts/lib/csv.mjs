/**
 * RFC 4180 CSV writer / reader shared by the ZiqWear export + import CLIs.
 *
 * Deliberately dependency-free so the ops scripts run on a bare `node` with no
 * install step. Behaviour we care about:
 *   - any field containing a double quote, comma, CR or LF is wrapped in
 *     double quotes and its inner quotes are doubled
 *   - fields with leading/trailing whitespace are quoted so the padding
 *     survives a round trip
 *   - line endings are CRLF, per the spec
 *   - records are separated by a trailing CRLF (no blank final line)
 *
 * The reader is a full state machine: it handles quoted fields, escaped
 * quotes, CRLF/LF/CR terminators, a UTF-8 BOM and a trailing empty line.
 */

/** Spreadsheet formula-injection guards: values starting with these are dangerous in Excel. */
export const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/** Primitives -> CSV-safe string. Handles Prisma Decimal, Date, JSON documents. */
export function toCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    // Prisma maps SQLite Decimal columns to a decimal.js instance whose
    // constructor name is MINIFIED in the generated client (it ships as "i"),
    // so `constructor.name === 'Decimal'` never matches. Identify it
    // structurally instead; JSON.stringify() of that object yields a quoted
    // string like "2990", which would poison a spreadsheet.
    const isDecimalLike =
      typeof value.toNumber === 'function' && typeof value.s === 'number' && 'd' in value;
    if (isDecimalLike) return value.toString();
    if (Array.isArray(value)) return JSON.stringify(value);
    return JSON.stringify(value);
  }
  return String(value);
}

function needsQuotes(raw) {
  return /[",\r\n]/.test(raw) || /^\s/.test(raw) || /\s$/.test(raw);
}

export function escapeField(value, { escapeFormulas = false } = {}) {
  let raw = toCell(value);
  if (escapeFormulas && raw.length > 0 && FORMULA_PREFIXES.includes(raw[0])) {
    raw = `'${raw}`;
  }
  return needsQuotes(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

/**
 * columns: [{ key, header?, value?(row) }]
 * `value` lets a caller derive a cell (e.g. an item summary) from the row.
 */
export function toCsv(rows, columns, options = {}) {
  const header = columns.map((c) => escapeField(c.header ?? c.key, options));
  const lines = [header.join(',')];

  for (const row of rows) {
    lines.push(
      columns
        .map((c) => escapeField(c.value ? c.value(row) : row[c.key], options))
        .join(','),
    );
  }

  return `${lines.join('\r\n')}\r\n`;
}

/** Full CSV text -> array of string arrays. */
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let rowActive = false; // any token of the current row has been seen

  const pushField = () => {
    row.push(field);
    field = '';
    rowActive = true;
  };
  const pushRow = () => {
    row.push(field);
    field = '';
    rows.push(row);
    row = [];
    rowActive = false;
    inQuotes = false;
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    // An unquoted field can legitimately start with a quote only as a
    // malformed CSV, so treat a quote on an empty field as a quoted field.
    if (ch === '"' && field === '') {
      inQuotes = true;
      rowActive = true;
      continue;
    }
    if (ch === ',') {
      pushField();
      continue;
    }
    if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1;
      pushRow();
      continue;
    }
    if (ch === '\n') {
      pushRow();
      continue;
    }

    field += ch;
    rowActive = true;
  }

  if (rowActive || field !== '') {
    row.push(field);
    rows.push(row);
  }

  // A trailing newline / blank lines should not surface as empty records.
  while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }

  return rows;
}

/**
 * CSV text -> { headers, records, errors }.
 * Rows whose width differs from the header row are reported instead of
 * silently truncated. `__record` is the 1-based record number including the
 * header row, NOT a physical line number: a quoted cell may span lines.
 */
export function parseCsvWithHeaders(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { headers: [], records: [], errors: [] };

  const headers = rows[0].map((h) => h.trim());
  const records = [];
  const errors = [];

  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i];
    const recordNo = i + 1;

    if (cells.length === 1 && cells[0] === '') continue; // blank line

    if (cells.length !== headers.length) {
      errors.push(`record ${recordNo}: expected ${headers.length} columns, found ${cells.length}`);
      continue;
    }

    const record = {};
    headers.forEach((h, idx) => {
      record[h] = cells[idx];
    });
    records.push({ __record: recordNo, ...record });
  }

  return { headers, records, errors };
}
