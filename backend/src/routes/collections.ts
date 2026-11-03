import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest, optionalAuth } from '../middleware/auth';

export const collectionRoutes = Router();

collectionRoutes.get('/', optionalAuth, async (_req, res) => {
  const collections = await prisma.collection.findMany({
    where: { isActive: true, OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] },
    include: { _count: { select: { products: true } } },
    orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
  });
  
  res.json({ collections });
});

collectionRoutes.get('/:slug', optionalAuth, async (req: AuthenticatedRequest, res) => {
  const { slug } = req.params;
  
  const collection = await prisma.collection.findUnique({
    where: { slug, isActive: true },
    include: {
      products: {
        include: { product: { include: { images: { where: { isPrimary: true }, take: 1 }, variants: { where: { isActive: true }, include: { inventory: true } } } } },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
  
  if (!collection) throw new AppError('Collection not found', 404, 'NOT_FOUND');
  
  res.json({ collection });
});