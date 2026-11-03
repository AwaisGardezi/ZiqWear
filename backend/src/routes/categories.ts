import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

export const categoryRoutes = Router();

categoryRoutes.get('/', async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: { children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } }, _count: { select: { products: { where: { isActive: true } } } } },
    orderBy: { sortOrder: 'asc' },
  });
  
  res.json({ categories });
});

categoryRoutes.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  
  const category = await prisma.category.findUnique({
    where: { slug, isActive: true },
    include: { children: { where: { isActive: true } }, parent: true },
  });
  
  if (!category) throw new AppError('Category not found', 404, 'NOT_FOUND');
  
  res.json({ category });
});