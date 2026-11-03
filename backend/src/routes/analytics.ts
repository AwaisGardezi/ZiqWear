import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { jsonField } from '../utils/json';
import { AuthenticatedRequest, optionalAuth } from '../middleware/auth';

export const analyticsRoutes = Router();

const trackEventSchema = z.object({
  eventName: z.string(),
  properties: z.record(z.any()).optional(),
  pageUrl: z.string().optional(),
  referrer: z.string().optional(),
});

// Track event (public)
analyticsRoutes.post('/track', optionalAuth, async (req: AuthenticatedRequest, res) => {
  const data = trackEventSchema.parse(req.body);
  
  await prisma.analyticsEvent.create({
    data: {
      eventName: data.eventName,
      customerId: req.customer?.id,
      sessionId: req.headers['x-session-id'] as string,
      properties: jsonField(data.properties),
      pageUrl: data.pageUrl,
      referrer: data.referrer,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    },
  });
  
  res.json({ success: true });
});

// Batch track events
analyticsRoutes.post('/track/batch', optionalAuth, async (req: AuthenticatedRequest, res) => {
  const { events } = req.body;
  
  if (!Array.isArray(events) || events.length === 0) {
    throw new AppError('Events array required', 400, 'INVALID_EVENTS');
  }
  
  await prisma.analyticsEvent.createMany({
    data: events.map((e: any) => ({
      eventName: e.eventName,
      customerId: req.customer?.id,
      sessionId: req.headers['x-session-id'] as string,
      properties: e.properties,
      pageUrl: e.pageUrl,
      referrer: e.referrer,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    })),
  });
  
  res.json({ success: true, count: events.length });
});