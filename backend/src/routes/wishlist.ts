import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

export const wishlistRoutes = Router();

const addToWishlistSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
});

wishlistRoutes.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const customerId = req.customer!.id;
  
  const items = await prisma.wishlistItem.findMany({
    where: { customerId },
    include: {
      product: { include: { images: { where: { isPrimary: true }, take: 1 }, variants: { where: { isActive: true }, include: { inventory: true } } } },
      variant: { include: { inventory: true, images: { where: { isPrimary: true }, take: 1 } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  
  res.json({ items });
});

wishlistRoutes.post('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const customerId = req.customer!.id;
  const data = addToWishlistSchema.parse(req.body);
  
  const product = await prisma.product.findUnique({
    where: { id: data.productId, isActive: true },
  });
  
  if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
  
  const existing = await prisma.wishlistItem.findUnique({
    where: { customerId_productId_variantId: { customerId, productId: data.productId, variantId: data.variantId || '' } },
  });
  
  if (existing) {
    res.json({ message: 'Already in wishlist', item: existing });
    return;
  }
  
  const item = await prisma.wishlistItem.create({
    data: { customerId, productId: data.productId, variantId: data.variantId },
  });
  
  res.status(201).json({ message: 'Added to wishlist', item });
});

wishlistRoutes.delete('/:productId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const customerId = req.customer!.id;
  const { productId } = req.params;
  const { variantId } = req.query;
  
  await prisma.wishlistItem.deleteMany({
    where: { customerId, productId, variantId: variantId as string || null },
  });
  
  res.json({ message: 'Removed from wishlist' });
});

wishlistRoutes.delete('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const customerId = req.customer!.id;
  
  await prisma.wishlistItem.deleteMany({ where: { customerId } });
  
  res.json({ message: 'Wishlist cleared' });
});