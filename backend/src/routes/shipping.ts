import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

export const shippingRoutes = Router();

const calculateShippingSchema = z.object({
  city: z.string(),
  province: z.string(),
  postalCode: z.string().optional(),
  subtotal: z.number().positive(),
  weight: z.number().optional(),
});

shippingRoutes.post('/calculate', async (req, res) => {
  const data = calculateShippingSchema.parse(req.body);
  
  const zones = await prisma.shippingZone.findMany({
    where: { isActive: true },
    include: { rates: { where: { isActive: true } } },
  });
  
  let matchedZone = null;
  let matchedRate = null;
  
  for (const zone of zones) {
    const countryMatch = zone.countries.includes(data.province) || zone.countries.includes('Pakistan');
    const provinceMatch = !zone.provinces || zone.provinces.split(',').map(p => p.trim()).includes(data.province);
    const cityMatch = !zone.cities || zone.cities.split(',').map(c => c.trim()).includes(data.city);
    const postalMatch = !zone.postalCodes || zone.postalCodes.split(',').map(p => p.trim()).includes(data.postalCode || '');
    
    if (countryMatch && provinceMatch && cityMatch && postalMatch) {
      for (const rate of zone.rates) {
        const minOrder = rate.minOrderValue ? Number(rate.minOrderValue) : 0;
        const maxOrder = rate.maxOrderValue ? Number(rate.maxOrderValue) : Infinity;
        const minWeight = rate.minWeight ? Number(rate.minWeight) : 0;
        const maxWeight = rate.maxWeight ? Number(rate.maxWeight) : Infinity;
        
        if (data.subtotal >= minOrder && data.subtotal <= maxOrder && (data.weight || 0) >= minWeight && (data.weight || 0) <= maxWeight) {
          matchedZone = zone;
          matchedRate = rate;
          break;
        }
      }
      if (matchedRate) break;
    }
  }
  
  if (!matchedRate) {
    // Default shipping
    const shippingFee = data.subtotal >= 5000 ? 0 : 250;
    return res.json({ shippingFee, freeShipping: data.subtotal >= 5000, estimatedDays: { min: 2, max: 5 }, method: 'Standard Delivery' });
  }
  
  const shippingFee = data.subtotal >= Number(matchedRate.freeShippingThreshold || 0) ? 0 : Number(matchedRate.price);
  
  res.json({
    shippingFee,
    freeShipping: data.subtotal >= Number(matchedRate.freeShippingThreshold || 0),
    estimatedDays: { min: matchedRate.estimatedDaysMin, max: matchedRate.estimatedDaysMax },
    method: matchedRate.name,
    zone: matchedZone?.name,
  });
});

// Get shipping zones (for checkout)
shippingRoutes.get('/zones', async (_req, res) => {
  const zones = await prisma.shippingZone.findMany({
    where: { isActive: true },
    include: { rates: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  });
  
  res.json({ zones });
});