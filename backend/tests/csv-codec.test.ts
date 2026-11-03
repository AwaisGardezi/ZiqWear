import { describe, it, expect } from 'vitest';
import { escapeField, parseCsv, parseCsvWithHeaders, toCell, toCsv } from '../scripts/lib/csv.mjs';

/**
 * The CSV codec used by export-orders / export-products / import-products.
 * Escaping bugs here would silently corrupt a spreadsheet an accountant opens,
 * so the nasty cases are pinned explicitly.
 */

describe('escapeField', () => {
  it('leaves a plain value unquoted', () => {
    expect(escapeField('ZQ-001')).toBe('ZQ-001');
    expect(escapeField('2990')).toBe('2990');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(escapeField('Freedom "Core" Tee')).toBe('"Freedom ""Core"" Tee"');
  });

  it('quotes values containing commas without touching the commas', () => {
    expect(escapeField('a,b')).toBe('"a,b"');
  });

  it('quotes values containing newlines', () => {
    expect(escapeField('line one\nline two')).toBe('"line one\nline two"');
    expect(escapeField('line one\r\nline two')).toBe('"line one\r\nline two"');
  });

  it('quotes leading and trailing whitespace so padding survives', () => {
    expect(escapeField('  spaced  ')).toBe('"  spaced  "');
  });

  it('renders null and undefined as an empty cell', () => {
    expect(escapeField(null)).toBe('');
    expect(escapeField(undefined)).toBe('');
  });

  it('neutralises spreadsheet formulas only when asked', () => {
    const payload = '=HYPERLINK("http://evil","click")';
    // Without the guard the cell is still safely quoted, inner quotes doubled.
    expect(escapeField(payload)).toBe('"=HYPERLINK(""http://evil"",""click"")"');
    expect(escapeField(payload, { escapeFormulas: true })).toBe(
      '"\'=HYPERLINK(""http://evil"",""click"")"',
    );
    expect(escapeField('+1 555 1234', { escapeFormulas: true })).toBe("'+1 555 1234");
    // A minus sign inside a number must not be mangled.
    expect(escapeField('-2990', { escapeFormulas: true })).toBe("'-2990");
    expect(escapeField('-2990')).toBe('-2990');
  });
});

describe('toCell', () => {
  it('formats Date as ISO-8601', () => {
    expect(toCell(new Date('2026-11-03T00:00:00.000Z'))).toBe('2026-11-03T00:00:00.000Z');
  });

  it('formats booleans as lowercase words', () => {
    expect(toCell(true)).toBe('true');
    expect(toCell(false)).toBe('false');
  });

  it('serialises arrays and objects as JSON text', () => {
    expect(toCell(['graphic', 'gothic'])).toBe('["graphic","gothic"]');
    expect(toCell({ city: 'Lahore' })).toBe('{"city":"Lahore"}');
  });

  it('renders a Prisma/decimal.js instance as a bare number, not a quoted string', () => {
    // Mirrors the runtime shape Prisma returns for a SQLite Decimal column:
    // constructor name is minified, so the codec must detect it structurally.
    const decimal = {
      s: 1,
      e: 3,
      d: [2990],
      toNumber: () => 2990,
      toString: () => '2990',
    };
    expect(toCell(decimal)).toBe('2990');
    // Guard against the regression this fixes: JSON.stringify would give "2990"
    // and the CSV writer would then emit """2990""".
    expect(toCell(decimal)).not.toContain('"');
  });

  it('renders non-finite numbers as empty rather than NaN', () => {
    expect(toCell(Number.NaN)).toBe('');
    expect(toCell(Infinity)).toBe('');
  });
});

describe('toCsv / parseCsv round trip', () => {
  const rows = [
    {
      handle: 'vanguard-oversized-tee',
      title: 'Vanguard Oversized Tee',
      description: 'Grey, garment-washed.\nBack panel print.',
      basePrice: '2990',
      tags: '["graphic","drop 01"]',
      isActive: true,
      empty: null,
      tracking: 'has ""double"" and, comma',
    },
  ];

  const columns = Object.keys(rows[0]).map((key) => ({ key }));

  it('emits a header row and CRLF terminators', () => {
    const csv = toCsv(rows, columns);
    expect(csv.startsWith('handle,title,description,')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(2);
  });

  it('reads back every field byte-for-byte', () => {
    const csv = toCsv(rows, columns);
    const parsed = parseCsvWithHeaders(csv);

    expect(parsed.errors).toEqual([]);
    expect(parsed.records).toHaveLength(1);

    const record = parsed.records[0];
    expect(record.handle).toBe('vanguard-oversized-tee');
    expect(record.title).toBe('Vanguard Oversized Tee');
    expect(record.description).toBe('Grey, garment-washed.\nBack panel print.');
    expect(record.tags).toBe('["graphic","drop 01"]');
    expect(record.isActive).toBe('true');
    expect(record.empty).toBe('');
    expect(record.tracking).toBe('has ""double"" and, comma');
  });

  it('supports derived columns', () => {
    const order = { items: [{ sku: 'ZQ-001', quantity: 2, size: 'S' }] };
    const csv = toCsv([order], [
      { key: 'orderNumber', value: () => 'ZQ-385953' },
      {
        key: 'itemsSummary',
        value: (o) => o.items.map((i) => `${i.sku} x${i.quantity} (${i.size})`).join(' | '),
      },
    ]);
    expect(csv).toBe('orderNumber,itemsSummary\r\nZQ-385953,ZQ-001 x2 (S)\r\n');
  });

  it('handles an empty row set by writing only the header', () => {
    expect(toCsv([], [{ key: 'a' }, { key: 'b' }])).toBe('a,b\r\n');
  });
});

describe('parseCsv edge cases', () => {
  it('strips a UTF-8 BOM', () => {
    expect(parseCsv('\ufeffa,b\r\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('accepts LF and CR terminators as well as CRLF', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a,b\r1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('parses a quoted field that starts with a quote after a comma', () => {
    // This shape used to break: the second field's opening quote was treated
    // as literal text, so the commas inside it leaked out as extra columns.
    expect(parseCsv('a,"has,comma"')).toEqual([['a', 'has,comma']]);
  });

  it('keeps an empty quoted field distinct from a missing one', () => {
    expect(parseCsv('a,"",b')).toEqual([['a', '', 'b']]);
  });

  it('parses a quoted field containing a newline', () => {
    expect(parseCsv('"one\ntwo",b')).toEqual([['one\ntwo', 'b']]);
  });

  it('does not invent a trailing empty record after a final newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('returns an empty result for empty input', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsvWithHeaders('')).toEqual({ headers: [], records: [], errors: [] });
  });

  it('trims header names but not cell values', () => {
    const { headers, records } = parseCsvWithHeaders(' handle , sku \r\n" cell ",ZQ-002\r\n');
    expect(headers).toEqual(['handle', 'sku']);
    expect(records[0].handle).toBe(' cell ');
  });

  it('reports a short or long row instead of silently truncating it', () => {
    // Header has 3 columns; BOTH data rows are the wrong width, so neither
    // becomes a record and both are surfaced as errors.
    const bad = parseCsvWithHeaders('a,b,c\r\n1,2\r\n1,2,3,4\r\n');
    expect(bad.records).toHaveLength(0);
    expect(bad.errors).toHaveLength(2);
    expect(bad.errors[0]).toContain('expected 3 columns, found 2');
    expect(bad.errors[1]).toContain('expected 3 columns, found 4');

    // A well-formed row alongside them is still imported.
    const mixed = parseCsvWithHeaders('a,b,c\r\n1,2,3\r\n1,2\r\n4,5,6\r\n');
    expect(mixed.records).toHaveLength(2);
    expect(mixed.errors).toHaveLength(1);
    expect(mixed.records.map((r) => r.__record)).toEqual([2, 4]);
  });

  it('numbers records from the header so operators can find them', () => {
    const { records } = parseCsvWithHeaders('a\r\n1\r\n2\r\n');
    expect(records.map((r) => r.__record)).toEqual([2, 3]);
  });
});
