import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_ORIGIN,
  STATIC_PAGES,
  buildRobots,
  buildSitemap,
  escapeXml,
  requestBase,
} from '../src/services/seo';

/**
 * Unit tests for the sitemap/robots builders.
 *
 * These run on every deploy because a wrong <loc> or a placeholder domain left
 * in production output is silent: search engines just stop indexing.
 */

const BASE = 'https://ziqwear.pk';

describe('requestBase', () => {
  it('uses the plain host when there is no proxy', () => {
    expect(requestBase({ host: 'localhost:4000' }, 'http')).toBe('http://localhost:4000');
  });

  it('prefers the forwarded proto and host over the local ones', () => {
    const headers = {
      host: '127.0.0.1:4000',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'ziqwear.pk',
    };
    expect(requestBase(headers, 'http')).toBe('https://ziqwear.pk');
  });

  it('takes the first entry of a comma-separated proxy chain', () => {
    const headers = {
      host: '127.0.0.1:4000',
      'x-forwarded-proto': 'https,http',
      'x-forwarded-host': 'ziqwear.pk, internal',
    };
    expect(requestBase(headers, 'http')).toBe('https://ziqwear.pk');
  });

  it('accepts array headers without producing "a,b"', () => {
    expect(requestBase({ host: ['ziqwear.pk'] }, 'https')).toBe('https://ziqwear.pk');
  });

  it('drops a trailing slash', () => {
    expect(requestBase({ 'x-forwarded-host': 'ziqwear.pk/' }, 'https')).toBe('https://ziqwear.pk');
  });
});

describe('buildSitemap', () => {
  it('emits valid envelope plus every static page', () => {
    const xml = buildSitemap(BASE, []);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
    for (const page of STATIC_PAGES) {
      expect(xml).toContain(`<loc>${BASE}${page.path}</loc>`);
    }
    expect(xml).not.toContain('<lastmod>');
  });

  it('adds one entry per product with a date-only lastmod', () => {
    const xml = buildSitemap(BASE, [
      { handle: 'oversized-tee', updatedAt: new Date('2026-04-09T13:45:10Z') },
    ]);
    expect(xml).toContain('<loc>https://ziqwear.pk/product/oversized-tee</loc>');
    expect(xml).toContain('<lastmod>2026-04-09</lastmod>');
    expect(xml).not.toContain('13:45');
  });

  it('never carries the placeholder origin', () => {
    expect(buildSitemap(BASE, [{ handle: 'x', updatedAt: new Date(0) }])).not.toContain(
      PLACEHOLDER_ORIGIN
    );
  });

  it('escapes XML metacharacters and percent-encodes the handle', () => {
    const xml = buildSitemap(BASE, [
      { handle: 'men&<>"\'tees', updatedAt: new Date('2026-01-01T00:00:00Z') },
    ]);
    // The handle is URI-encoded first, so the only character left that needs an
    // XML entity is the apostrophe encodeURIComponent passes through.
    expect(xml).toContain('<loc>https://ziqwear.pk/product/men%26%3C%3E%22&apos;tees</loc>');
    expect(xml).not.toContain('men&<');
  });

  it('produces parseable XML with balanced url nodes', () => {
    const xml = buildSitemap(BASE, [
      { handle: 'a', updatedAt: new Date('2026-01-01T00:00:00Z') },
      { handle: 'b', updatedAt: new Date('2026-01-02T00:00:00Z') },
    ]);
    const opens = (xml.match(/<url>/g) ?? []).length;
    const closes = (xml.match(/<\/url>/g) ?? []).length;
    expect(opens).toBe(STATIC_PAGES.length + 2);
    expect(closes).toBe(opens);
  });
});

describe('escapeXml', () => {
  it('replaces all five predefined entities', () => {
    expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });
});

describe('buildRobots', () => {
  const template = [
    '# comment',
    'User-agent: *',
    'Disallow: /admin',
    '',
    `Sitemap: ${PLACEHOLDER_ORIGIN}/sitemap.xml`,
    '',
  ].join('\n');

  it('rewrites the placeholder origin to the live host', () => {
    const txt = buildRobots(BASE, template);
    expect(txt).toContain(`Sitemap: ${BASE}/sitemap.xml`);
    expect(txt).not.toContain(PLACEHOLDER_ORIGIN);
  });

  it('leaves disallow rules untouched', () => {
    expect(buildRobots(BASE, template)).toContain('Disallow: /admin');
  });

  it('appends a sitemap line when the template lost it', () => {
    const txt = buildRobots(BASE, 'User-agent: *\nDisallow: /api/\n');
    expect(txt.trimEnd().endsWith(`Sitemap: ${BASE}/sitemap.xml`)).toBe(true);
  });

  it('does not append when a sitemap line already exists', () => {
    const occurrences = (buildRobots(BASE, template).match(/Sitemap:/gi) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it('detects an existing sitemap line regardless of case or indent', () => {
    const txt = buildRobots(BASE, 'User-agent: *\n  sitemap: https://other.example/sitemap.xml');
    expect(txt.match(/Sitemap:/gi)?.length).toBe(1);
  });
});
