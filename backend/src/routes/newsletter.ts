import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { jsonField } from '../utils/json';

export const newsletterRoutes = Router();

const subscribeSchema = z.object({
  email: z.string().email(),
  name: z.string().max(100).optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

newsletterRoutes.post('/subscribe', async (req, res) => {
  const data = subscribeSchema.parse(req.body);
  
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: data.email.toLowerCase() } });
  
  if (existing) {
    if (!existing.isActive) {
      await prisma.newsletterSubscriber.update({
        where: { id: existing.id },
        data: { isActive: true, unsubscribedAt: null, name: data.name || existing.name, source: data.source || existing.source, tags: jsonField([...new Set([...(JSON.parse(existing.tags || '[]') as string[]), ...(data.tags || [])])]) },
      });
    }
    res.json({ message: 'Already subscribed', subscriber: { email: existing.email } });
    return;
  }
  
  const subscriber = await prisma.newsletterSubscriber.create({
    data: { email: data.email.toLowerCase(), name: data.name, source: data.source, tags: jsonField(data.tags || []) },
  });
  
  res.status(201).json({ message: 'Subscribed successfully', subscriber });
});

newsletterRoutes.post('/unsubscribe', async (req, res) => {
  const { email } = req.body;
  
  if (!email) throw new AppError('Email required', 400, 'EMAIL_REQUIRED');
  
  const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { email: email.toLowerCase() } });
  
  if (!subscriber) {
    res.json({ message: 'Email not found' });
    return;
  }
  
  await prisma.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: { isActive: false, unsubscribedAt: new Date() },
  });
  
  res.json({ message: 'Unsubscribed successfully' });
});