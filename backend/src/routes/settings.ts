import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

export const settingsRoutes = Router();

// Get public site settings
settingsRoutes.get('/', async (_req, res) => {
  let settings = await prisma.siteSettings.findUnique({ where: { id: 'singleton' } });
  
  if (!settings) {
    settings = await prisma.siteSettings.create({ data: { id: 'singleton' } });
  }
  
  // Return only public settings
  const publicSettings = {
    storeName: settings.storeName,
    logo: settings.logo,
    favicon: settings.favicon,
    tagline: settings.tagline,
    brandMeaning: settings.brandMeaning,
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    whatsappNumber: settings.whatsappNumber,
    address: settings.address,
    businessHours: settings.businessHours,
    socialLinks: settings.socialLinks,
    themeColors: settings.themeColors,
    typography: settings.typography,
    announcementBar: settings.announcementBar,
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
  };
  
  res.json({ settings: publicSettings });
});

// Get SEO settings for a path
settingsRoutes.get('/seo/:path(*)', async (req, res) => {
  const path = req.params.path || '/';
  const seo = await prisma.seoSetting.findUnique({ where: { path } });
  
  res.json({ seo });
});