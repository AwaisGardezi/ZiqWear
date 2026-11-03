import 'express-async-errors';
import express, { Application, Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { apiRoutes } from './routes';
import { legacyRoutes } from './routes/legacy';
import { seoRoutes } from './routes/seo';

// Project root - works from both src (tsx) and dist (compiled).
const ROOT = path.resolve(__dirname, '../..');
const ASSETS_DIR = path.join(ROOT, 'assets');

// Only the original storefront pages are exposed under /legacy.
const LEGACY_PAGES = [
  'index', 'shop', 'product', 'wardrobe', 'checkout', 'orders', 'contact', 'admin',
];

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  app.use(cors(config.cors));
  app.use(compression());

  // Stripe webhooks verify the raw request body against the signing secret, so
  // this exact path must keep the unparsed bytes. Mounted before express.json,
  // which will then skip it because the body is already consumed.
  app.use(
    `${config.apiPrefix}/payments/stripe/webhook`,
    express.raw({ type: 'application/json' })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(config.cookie.secret));

  if (config.nodeEnv !== 'test') {
    app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
  }

  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
  });

  // ------------------------------------------------------------- SEO endpoints
  // Generated per request so the URLs carry the real host instead of a
  // placeholder domain.
  app.use(seoRoutes);

  // ------------------------------------------------------------ shared assets
  // Catalogue photography is used by both the new storefront and the old pages.
  app.use('/assets', express.static(ASSETS_DIR, { maxAge: '1h' }));

  // -------------------------------------------------- original Ziqwear site
  app.get(['/legacy', '/legacy/'], (_req: Request, res: Response) => {
    res.redirect('/legacy/index.html');
  });

  app.use('/legacy/assets', express.static(ASSETS_DIR, { maxAge: '1h' }));

  app.get('/legacy/:page', (req: Request, res: Response) => {
    const page = req.params.page.replace(/\.html$/i, '').replace(/[^a-z0-9-]/gi, '');
    if (!LEGACY_PAGES.includes(page)) {
      res.status(404).send('Page not found');
      return;
    }
    const file = path.join(ROOT, `${page}.html`);
    if (!fs.existsSync(file)) {
      res.status(404).send('Page not found');
      return;
    }
    res.sendFile(file);
  });

  // --------------------------------------------- legacy storefront API (/api)
  app.use('/api', legacyRoutes);

  // ------------------------------------------------------------------- new API
  app.use(config.apiPrefix, apiRoutes);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}
