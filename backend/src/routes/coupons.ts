import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

export const couponRoutes = Router();

const validateCouponSchema = z.object({
  code: z.string(),
  subtotal: z.number().positive(),
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })).optional(),
});

couponRoutes.post('/validate', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const customerId = req.customer!.id;
  const data = validateCouponSchema.parse(req.body);
  
  const coupon = await prisma.coupon.findUnique({
    where: { code: data.code.toUpperCase(), isActive: true },
  });
  
  if (!coupon) throw new AppError('Invalid coupon code', 404, 'INVALID_COUPON');
  
  const now = new Date();
  if ((coupon.startsAt && coupon.startsAt > now) || (coupon.expiresAt && coupon.expiresAt < now)) {
    throw new AppError('Coupon has expired', 400, 'COUPON_EXPIRED');
  }
  
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    throw new AppError('Coupon usage limit reached', 400, 'COUPON_LIMIT_REACHED');
  }
  
  const usageCount = await prisma.couponUsage.count({ where: { couponId: coupon.id, customerId } });
  if (usageCount >= coupon.perCustomerLimit) {
    throw new AppError('Coupon usage limit per customer reached', 400, 'COUPON_CUSTOMER_LIMIT');
  }
  
  if (coupon.minPurchase && data.subtotal < Number(coupon.minPurchase)) {
    throw new AppError(`Minimum purchase of ${coupon.minPurchase} required`, 400, 'COUPON_MIN_PURCHASE');
  }
  
  // Check eligible products/collections
  if (!coupon.appliesToAll && data.items) {
    const productIds = data.items.map(i => i.productId);
    const eligibleProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, OR: [{ id: { in: coupon.productIds as unknown as string[] } }, { collections: { some: { collectionId: { in: coupon.collectionIds as unknown as string[] } } } }] },
    });
    if (eligibleProducts.length !== productIds.length) {
      throw new AppError('Coupon not applicable to all items in cart', 400, 'COUPON_NOT_APPLICABLE');
    }
  }
  
  let discount = 0;
  if (coupon.type === 'PERCENTAGE') {
    discount = data.subtotal * Number(coupon.value) / 100;
    if (coupon.maxDiscount && discount > Number(coupon.maxDiscount)) discount = Number(coupon.maxDiscount);
  } else if (coupon.type === 'FIXED_AMOUNT') {
    discount = Number(coupon.value);
  } else if (coupon.type === 'FREE_SHIPPING') {
    discount = 0; // Handled separately
  }
  
  res.json({
    coupon: { id: coupon.id, code: coupon.code, name: coupon.name, type: coupon.type, value: Number(coupon.value), discount, freeShipping: coupon.type === 'FREE_SHIPPING' },
  });
});