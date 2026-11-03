#!/usr/bin/env node
/**
 * check-static.mjs - SEO / structural lint for the vanilla-JS storefront at the
 * repo root. Used by the `static` job in .github/workflows/ci.yml and runnable
 * locally with no dependencies:
 *
 *   node backend/scripts/check-static.mjs            # report, exit 0 if no errors
 *   node backend/scripts/check-static.mjs --strict   # warnings also fail
 *
 * Scope: the root *.html pages, robots.txt and sitemap.xml. It only READS the
 * storefront - it never edits HTML, because another agent owns those files.
 *
 * ERROR (fails CI):
 *   - an <html> page with no <title>
 *   - a page with no Content-Security-Policy meta tag
 *   - a page with no <html lang="...">
 *   - an internal link (href/src) that points at a file which does not exist
 *   - robots.txt or sitemap.xml missing / unreadable
 *   - sitemap.xml referencing a local page that does not exist
 * WARNING (informational unless --strict):
 *   - missing meta description
 *   - missing og:title / og:description / og:type
 *   - missing canonical link
 */

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './lib/paths.mjs';

const STRICT = process.argv.includes('--strict');

const PAGES = [
  'index.html',
  'shop.html',
  'product.html',
  'wardrobe.html',
  'contact.html',
  'checkout.html',
  'orders.html',
  'admin.html',
];

// Pages that should never be indexed; still linted, just noted.
const NOINDEX_EXPECTED = new Set(['admin.html', 'checkout.html', 'orders.html']);

const errors = [];
const warnings = [];
const rows = [];

function readPage(name) {
  const full = path.join(REPO_ROOT, name);
  if (!fs.existsSync(full)) {
    errors.push(`${name}: expected page is missing from the repo root`);
    return null;
  }
  return { full, text: fs.readFileSync(full, 'utf8') };
}

/** Extracts internal href/src targets, ignoring external, data, mailto and fragments. */
function internalRefs(text) {
  const refs = [];
  const re = /(?:href|src)\s*=\s*["']([^"'#?]+)(?:[?#][^"']*)?["']/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const value = m[1].trim();
    if (!value) continue;
    if (/^(https?:|data:|mailto:|tel:|javascript:|blob:)/i.test(value)) continue;
    if (value.startsWith('//')) continue;
    if (value.startsWith('/')) {
      // Root-relative: resolve against the repo root for the static preview server.
      refs.push({ value, resolved: path.join(REPO_ROOT, value.replace(/^\/+/, '')) });
      continue;
    }
    refs.push({ value, resolved: path.resolve(REPO_ROOT, value) });
  }
  return refs;
}

for (const name of PAGES) {
  const page = readPage(name);
  if (!page) continue;
  const text = page.text;

  const has = (re) => re.test(text);
  const title = /<title>[^<]+<\/title>/i.test(text);
  const description = /<meta\s+name=["']description["']\s+content=["'][^"']+["']/i.test(text);
  const csp = /http-equiv=["']content-security-policy["']/i.test(text);
  const lang = /<html[^>]+\blang=["'][a-z]/i.test(text);
  const canonical = /<link\s+rel=["']canonical["']/i.test(text);
  const ogTitle = /<meta\s+property=["']og:title["']/i.test(text);
  const ogDescription = /<meta\s+property=["']og:description["']/i.test(text);
  const ogType = /<meta\s+property=["']og:type["']/i.test(text);
  const ogImage = /<meta\s+property=["']og:image["']/i.test(text);
  const robots = /<meta\s+name=["']robots["']/i.test(text);
  const viewport = /<meta\s+name=["']viewport["']/i.test(text);

  if (!title) errors.push(`${name}: no non-empty <title>`);
  if (!csp) errors.push(`${name}: no Content-Security-Policy meta tag`);
  if (!lang) errors.push(`${name}: <html> has no lang attribute`);
  if (!viewport) warnings.push(`${name}: no viewport meta tag`);
  if (!description) warnings.push(`${name}: missing meta description`);
  if (!canonical) warnings.push(`${name}: missing <link rel="canonical">`);
  for (const [label, present] of [
    ['og:title', ogTitle],
    ['og:description', ogDescription],
    ['og:type', ogType],
    ['og:image', ogImage],
  ]) {
    if (!present) warnings.push(`${name}: missing ${label}`);
  }
  if (NOINDEX_EXPECTED.has(name) && !robots) {
    warnings.push(`${name}: page is disallowed in robots.txt but has no <meta name="robots"> fallback`);
  }

  for (const ref of internalRefs(text)) {
    if (!fs.existsSync(ref.resolved)) {
      errors.push(`${name}: internal link "${ref.value}" does not exist`);
    }
  }

  rows.push({
    page: name,
    title: title ? 'ok' : 'MISSING',
    description: description ? 'ok' : 'missing',
    og: [ogTitle && ogDescription && ogType ? 'ok' : 'partial', ogImage ? '+image' : '-image'].join(' '),
    canonical: canonical ? 'ok' : 'missing',
    csp: csp ? 'ok' : 'MISSING',
  });
}

// robots.txt / sitemap.xml
const robotsPath = path.join(REPO_ROOT, 'robots.txt');
if (!fs.existsSync(robotsPath)) {
  errors.push('robots.txt is missing from the repo root');
} else {
  const robots = fs.readFileSync(robotsPath, 'utf8');
  if (!/sitemap:/i.test(robots)) warnings.push('robots.txt has no Sitemap: line');
  for (const forbidden of ['/admin', '/checkout', '/orders', '/api']) {
    if (!robots.includes(forbidden)) {
      warnings.push(`robots.txt does not disallow ${forbidden}`);
    }
  }
}

const sitemapPath = path.join(REPO_ROOT, 'sitemap.xml');
if (!fs.existsSync(sitemapPath)) {
  errors.push('sitemap.xml is missing from the repo root');
} else {
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  if (!sitemap.trim().startsWith('<?xml')) {
    errors.push('sitemap.xml must start with an XML declaration');
  }
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (locs.length === 0) errors.push('sitemap.xml contains no <loc> entries');
  for (const loc of locs) {
    if (!/^https?:\/\//.test(loc)) {
      errors.push(`sitemap.xml <loc> is not an absolute URL: ${loc}`);
      continue;
    }
    const pathname = new URL(loc).pathname.replace(/^\/+/, '');
    if (pathname && !pathname.endsWith('/') && !fs.existsSync(path.join(REPO_ROOT, pathname))) {
      errors.push(`sitemap.xml points at a file that does not exist: ${pathname}`);
    }
    if (/\/(checkout|orders|admin)(\.html)?$/i.test(loc)) {
      errors.push(`sitemap.xml should not list a private page: ${loc}`);
    }
  }
}

// ---- report ---------------------------------------------------------------
const widths = { page: 14, title: 7, description: 9, og: 14, canonical: 9, csp: 7 };
const header = `page          title   description og             canonical  csp`;
console.log(header);
console.log('-'.repeat(header.length));
for (const r of rows) {
  console.log(
    r.page.padEnd(widths.page) +
      r.title.padEnd(widths.title + 2) +
      r.description.padEnd(widths.description + 2) +
      r.og.padEnd(widths.og + 2) +
      r.canonical.padEnd(widths.canonical + 2) +
      r.csp,
  );
}

console.log('');
for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);

const warnCount = warnings.length;
const errCount = errors.length;
console.log('');
console.log(
  `checked ${rows.length} page(s): ${errCount} error(s), ${warnCount} warning(s)`,
);

if (errCount > 0 || (STRICT && warnCount > 0)) {
  process.exitCode = 1;
} else {
  console.log('static check: PASS (warnings are informational; use --strict to fail on them)');
}
