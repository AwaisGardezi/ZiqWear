/**
 * Pure sitemap.xml / robots.txt builders.
 *
 * Both responses are derived from the incoming request rather than a config
 * value, because the same code has to produce correct absolute URLs on
 * localhost:8777, on the production apex, and on www. Kept free of Prisma and
 * the filesystem so the route handlers stay thin and these functions stay
 * unit-testable.
 */

// The placeholder origin used by the tracked robots.txt and sitemap.xml files.
export const PLACEHOLDER_ORIGIN = 'https://ziqwear.com';

// Pages the production host actually serves. nginx puts the React build at the
// root; the legacy pages live under /legacy/, which robots.txt disallows.
export const STATIC_PAGES: ReadonlyArray<{ path: string; priority: string; changefreq: string }> = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/shop', priority: '0.9', changefreq: 'daily' },
  { path: '/wardrobe', priority: '0.7', changefreq: 'weekly' },
];

export interface SitemapProduct {
  handle: string;
  updatedAt: Date;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Absolute base for the current request, behind a TLS-terminating proxy. */
export function requestBase(headers: Record<string, unknown>, fallbackProto: string): string {
  const header = (name: string): string => {
    const raw = headers[name];
    if (Array.isArray(raw)) return String(raw[0] ?? '');
    return String(raw ?? '');
  };
  // A proxy chain can send comma-separated values; the first entry is the
  // client-facing one.
  const proto = (header('x-forwarded-proto') || fallbackProto).split(',')[0].trim() || fallbackProto;
  const host = header('x-forwarded-host') || header('host');
  return `${proto}://${String(host).split(',')[0].trim()}`.replace(/\/+$/, '');
}

export function buildSitemap(base: string, products: ReadonlyArray<SitemapProduct>): string {
  const urls: string[] = [];

  for (const page of STATIC_PAGES) {
    urls.push(
      `  <url>\n    <loc>${escapeXml(base + page.path)}</loc>\n` +
        `    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`
    );
  }

  for (const product of products) {
    urls.push(
      `  <url>\n    <loc>${escapeXml(`${base}/product/${encodeURIComponent(product.handle)}`)}</loc>\n` +
        `    <lastmod>${isoDate(product.updatedAt)}</lastmod>\n` +
        `    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
    );
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') +
    '\n</urlset>\n'
  );
}

/**
 * robots.txt is read from the tracked template at the repo root so the two
 * servers cannot drift apart; only the origin is rewritten to the live host,
 * and a Sitemap line is appended if the template lost it.
 */
export function buildRobots(base: string, template: string): string {
  let txt = template.split(PLACEHOLDER_ORIGIN).join(base);

  if (!/^\s*sitemap:/im.test(txt)) {
    txt = `${txt.replace(/\s+$/, '')}\n\nSitemap: ${base}/sitemap.xml\n`;
  }
  return txt;
}
