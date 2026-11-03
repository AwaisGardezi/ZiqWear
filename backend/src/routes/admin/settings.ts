import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { logAdminActivity } from '../../utils/audit';
import { AuthenticatedRequest, adminAuthMiddleware, requirePermission } from '../../middleware/auth';

export const adminSettingsRoutes = Router();
adminSettingsRoutes.use(adminAuthMiddleware);

const settingsSchema = z.object({
  storeName: z.string().optional(),
  logo: z.string().optional(),
  favicon: z.string().optional(),
  tagline: z.string().optional(),
  brandMeaning: z.string().optional(),
  currency: z.string().optional(),
  currencySymbol: z.string().optional(),
  defaultCountry: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  address: z.string().optional(),
  businessHours: z.string().optional(),
  socialLinks: z.any().optional(),
  themeColors: z.any().optional(),
  typography: z.any().optional(),
  announcementBar: z.any().optional(),
  seoDefaults: z.any().optional(),
  shippingSettings: z.any().optional(),
  taxSettings: z.any().optional(),
  paymentSettings: z.any().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().optional(),
});

adminSettingsRoutes.get('/', requirePermission('settings:read'), async (_req: AuthenticatedRequest, res) => {
  let settings = await prisma.siteSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings) settings = await prisma.siteSettings.create({ data: { id: 'singleton' } });
  res.json({ settings });
});

adminSettingsRoutes.patch('/', requirePermission('settings:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = settingsSchema.parse(req.body);
  
  const settings = await prisma.siteSettings.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data },
  });
  
  await logAdminActivity(prisma, { adminId, action: 'SETTINGS_UPDATE', entityType: 'SiteSettings', entityId: 'singleton', newData: data }, req);
  res.json({ message: 'Settings updated', settings });
});

const seoSchema = z.object({
  path: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
  ogType: z.string().optional(),
  twitterCard: z.string().optional(),
  twitterTitle: z.string().optional(),
  twitterDescription: z.string().optional(),
  twitterImage: z.string().optional(),
  canonicalUrl: z.string().optional(),
  robots: z.string().optional(),
  structuredData: z.any().optional(),
});

adminSettingsRoutes.get('/seo', requirePermission('settings:read'), async (_req: AuthenticatedRequest, res) => {
  const seo = await prisma.seoSetting.findMany({ orderBy: { path: 'asc' } });
  res.json({ seo });
});

adminSettingsRoutes.post('/seo', requirePermission('settings:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = seoSchema.parse(req.body);
  
  const seo = await prisma.seoSetting.upsert({
    where: { path: data.path },
    update: data,
    create: data,
  });
  
  await logAdminActivity(prisma, { adminId, action: 'SEO_UPDATE', entityType: 'SeoSetting', entityId: seo.id, newData: data }, req);
  res.json({ message: 'SEO settings updated', seo });
});