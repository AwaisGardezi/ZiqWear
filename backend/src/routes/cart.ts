import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

export const cartRoutes = Router();

const addToCartSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.number().int().positive().max(99).default(1),
});

const updateCartSchema = z.object({
  quantity: z.number().int().min(0).max(99),
});

// Get cart
cartRoutes.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const customerId = req.customer!.id;
  
  const cartItems = await prisma.cartItem.findMany({
    where: { customerId },
    include: {
      product: { include: { images: { where: { isPrimary: true }, take: 1 } } },
      variant: { include: { inventory: true, images: { where: { isPrimary: true }, take: 1 } } },
    },
  });
  
  const items = cartItems.map(item => ({
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
    product: {
      id: item.product.id,
      title: item.product.title,
      handle: item.product.handle,
      image: item.product.images[0]?.url,
      basePrice: Number(item.product.basePrice),
    },
    variant: item.variant ? {
      id: item.variant.id,
      title: item.variant.title,
      color: item.variant.color,
      size: item.variant.size,
      price: Number(item.variant.price),
      compareAtPrice: item.variant.compareAtPrice ? Number(item.variant.compareAtPrice) : null,
      image: item.variant.images[0]?.url,
      stock: item.variant.inventory?.quantity || 0,
    } : null,
    unitPrice: item.variant ? Number(item.variant.price) : Number(item.product.basePrice),
    totalPrice: (item.variant ? Number(item.variant.price) : Number(item.product.basePrice)) * item.quantity,
  }));
  
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  
  res.json({ items, subtotal, itemCount: items.reduce((sum, item) => sum + item.quantity, 0) });
});

// Add to cart
cartRoutes.post('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const customerId = req.customer!.id;
  const data = addToCartSchema.parse(req.body);
  
  // Verify product and variant
  const product = await prisma.product.findUnique({
    where: { id: data.productId, isActive: true },
    include: { variants: { where: { isActive: true }, include: { inventory: true } } },
  });
  
  if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
  
  let variant = null;
  if (data.variantId) {
    variant = product.variants.find(v => v.id === data.variantId);
    if (!variant) throw new AppError('Variant not found', 404, 'NOT_FOUND');
  } else if (product.variants.length > 0) {
    variant = product.variants[0];
  }
  
  const stock = variant?.inventory?.quantity || 0;
  if (stock < data.quantity) {
    throw new AppError('Insufficient stock', 400, 'INSUFFICIENT_STOCK');
  }
  
  // Check existing cart item
  const existing = await prisma.cartItem.findFirst({
    where: { customerId, productId: data.productId, variantId: data.variantId },
  });
  
  let cartItem;
  if (existing) {
    const newQty = existing.quantity + data.quantity;
    if (stock < newQty) throw new AppError('Insufficient stock', 400, 'INSUFFICIENT_STOCK');
    
    cartItem = await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: newQty },
    });
  } else {
    cartItem = await prisma.cartItem.create({
      data: { customerId, productId: data.productId, variantId: data.variantId, quantity: data.quantity },
    });
  }
  
  res.status(201).json({ message: 'Added to cart', cartItem });
});

// Update cart item
cartRoutes.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const customerId = req.customer!.id;
  const { id } = req.params;
  const data = updateCartSchema.parse(req.body);
  
  const cartItem = await prisma.cartItem.findFirst({
    where: { id, customerId },
    include: { variant: { include: { inventory: true } }, product: { include: { variants: { include: { inventory: true } } } } },
  });
  
  if (!cartItem) throw new AppError('Cart item not found', 404, 'NOT_FOUND');
  
  if (data.quantity === 0) {
    await prisma.cartItem.delete({ where: { id } });
    res.json({ message: 'Item removed from cart' });
    return;
  }
  
  const stock = cartItem.variant?.inventory?.quantity || 
                cartItem.product.variants[0]?.inventory?.quantity || 0;
  
  if (stock < data.quantity) {
    throw new AppError('Insufficient stock', 400, 'INSUFFICIENT_STOCK');
  }
  
  const updated = await prisma.cartItem.update({
    where: { id },
    data: { quantity: data.quantity },
  });
  
  res.json({ message: 'Cart updated', cartItem: updated });
});

// Remove from cart
cartRoutes.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const customerId = req.customer!.id;
  const { id } = req.params;
  
  await prisma.cartItem.deleteMany({ where: { id, customerId } });
  
  res.json({ message: 'Item removed from cart' });
});

// Clear cart
cartRoutes.delete('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const customerId = req.customer!.id;
  
  await prisma.cartItem.deleteMany({ where: { customerId } });
  
  res.json({ message: 'Cart cleared' });
});