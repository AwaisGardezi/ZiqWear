import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { jsonField } from '../../utils/json';
import { AuthenticatedRequest, adminAuthMiddleware, requirePermission } from '../../middleware/auth';

export const adminShippingRoutes = Router();
adminShippingRoutes.use(adminAuthMiddleware);

const zoneSchema = z.object({
  name: z.string().min(1).max(100),
  countries: z.array(z.string()).default(['Pakistan']),
  provinces: z.string().optional(),
  cities: z.string().optional(),
  postalCodes: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const rateSchema = z.object({
  zoneId: z.string(),
  name: z.string().min(1).max(100),
  minOrderValue: z.number().positive().optional(),
  maxOrderValue: z.number().positive().optional(),
  minWeight: z.number().positive().optional(),
  maxWeight: z.number().positive().optional(),
  price: z.number().min(0),
  freeShippingThreshold: z.number().positive().optional(),
  estimatedDaysMin: z.number().int().positive().default(1),
  estimatedDaysMax: z.number().int().positive().default(5),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

adminShippingRoutes.get('/zones', requirePermission('shipping:read'), async (_req: AuthenticatedRequest, res) => {
  const zones = await prisma.shippingZone.findMany({ include: { rates: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } });
  res.json({ zones });
});

adminShippingRoutes.post('/zones', requirePermission('shipping:create'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = zoneSchema.parse(req.body);
  
  const zone = await prisma.shippingZone.create({ data: { ...data, countries: jsonField(data.countries) } });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'SHIPPING_ZONE_CREATE', entityType: 'ShippingZone', entityId: zone.id, newData: JSON.stringify(zone) } });
  res.status(201).json({ message: 'Zone created', zone });
});

adminShippingRoutes.patch('/zones/:id', requirePermission('shipping:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = zoneSchema.partial().parse(req.body);
  
  const zone = await prisma.shippingZone.update({ where: { id: req.params.id }, data: { ...data, countries: data.countries ? jsonField(data.countries) : undefined } });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'SHIPPING_ZONE_UPDATE', entityType: 'ShippingZone', entityId: zone.id, newData: JSON.stringify(data) } });
  res.json({ message: 'Zone updated', zone });
});

adminShippingRoutes.delete('/zones/:id', requirePermission('shipping:delete'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  await prisma.shippingZone.delete({ where: { id: req.params.id } });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'SHIPPING_ZONE_DELETE', entityType: 'ShippingZone', entityId: req.params.id } });
  res.json({ message: 'Zone deleted' });
});

adminShippingRoutes.post('/rates', requirePermission('shipping:create'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = rateSchema.parse(req.body);
  
  const rate = await prisma.shippingRate.create({ data });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'SHIPPING_RATE_CREATE', entityType: 'ShippingRate', entityId: rate.id, newData: JSON.stringify(rate) } });
  res.status(201).json({ message: 'Rate created', rate });
});

adminShippingRoutes.patch('/rates/:id', requirePermission('shipping:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = rateSchema.partial().parse(req.body);
  
  const rate = await prisma.shippingRate.update({ where: { id: req.params.id }, data });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'SHIPPING_RATE_UPDATE', entityType: 'ShippingRate', entityId: rate.id, newData: JSON.stringify(data) } });
  res.json({ message: 'Rate updated', rate });
});

adminShippingRoutes.delete('/rates/:id', requirePermission('shipping:delete'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  await prisma.shippingRate.delete({ where: { id: req.params.id } });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'SHIPPING_RATE_DELETE', entityType: 'ShippingRate', entityId: req.params.id } });
  res.json({ message: 'Rate deleted' });
});