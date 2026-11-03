import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { prisma } from '../lib/prisma';
import { buildRobots, buildSitemap, requestBase } from '../services/seo';

/**
 * SEO endpoints for the deployed host.
 *
 * On the local Windows launcher, server.ps1 generates these two responses from
 * the live request host. On a server the Node API is the only process behind
 * nginx, so it has to answer them too — otherwise /sitemap.xml 404s on the
 * production domain while working fine on localhost.
 */
export const seoRoutes = Router();

// Repo root — works from src (tsx) and dist (compiled), same convention as app.ts.
const ROOT = path.resolve(__dirname, '../../..');

/** Cached so a crawler sweep does not re-read the file for every request. */
let robotsTemplateCache: string | null = null;

function robotsTemplate(): string {
  if (robotsTemplateCache === null) {
    try {
      robotsTemplateCache = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
    } catch {
      robotsTemplateCache = [
        'User-agent: *',
        'Disallow: /admin',
        'Disallow: /checkout',
        'Disallow: /orders',
        'Disallow: /account',
        'Disallow: /api/',
        'Disallow: /legacy/',
        'Disallow: /cart',
        '',
      ].join('\n');
    }
  }
  return robotsTemplateCache;
}

seoRoutes.get('/sitemap.xml', async (req, res) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { handle: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });
  const xml = buildSitemap(requestBase(req.headers, req.protocol), products);
  res.type('application/xml; charset=utf-8').set('Cache-Control', 'no-store').send(xml);
});

seoRoutes.get('/robots.txt', (req, res) => {
  const txt = buildRobots(requestBase(req.headers, req.protocol), robotsTemplate());
  res.type('text/plain; charset=utf-8').set('Cache-Control', 'no-store').send(txt);
});
