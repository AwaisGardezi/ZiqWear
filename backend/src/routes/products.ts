import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest, optionalAuth } from '../middleware/auth';

export const productRoutes = Router();

const productQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['featured', 'newest', 'best', 'price-asc', 'price-desc', 'name']).default('featured'),
  category: z.string().optional(),
  collection: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  inStock: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  newArrival: z.coerce.boolean().optional(),
  bestseller: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

productRoutes.get('/', optionalAuth, async (req: AuthenticatedRequest, res) => {
  const query = productQuerySchema.parse(req.query);
  
  const where: any = { isActive: true };
  
  if (query.category) where.category = { slug: query.category };
  if (query.collection) where.collections = { some: { collection: { slug: query.collection } } };
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.basePrice = {};
    if (query.minPrice !== undefined) where.basePrice.gte = query.minPrice;
    if (query.maxPrice !== undefined) where.basePrice.lte = query.maxPrice;
  }
  if (query.inStock) where.variants = { some: { inventory: { quantity: { gt: 0 } } } };
  if (query.featured) where.isFeatured = true;
  if (query.newArrival) where.isNewArrival = true;
  if (query.bestseller) where.isBestseller = true;
  if (query.search) {
    where.OR = [
      { title: { contains: query.search } },
      { description: { contains: query.search } },
      { sku: { contains: query.search } },
    ];
  }
  
  let orderBy: any = {};
  switch (query.sort) {
    case 'newest': orderBy.createdAt = 'desc'; break;
    case 'best': orderBy.soldCount = 'desc'; break;
    case 'price-asc': orderBy.basePrice = 'asc'; break;
    case 'price-desc': orderBy.basePrice = 'desc'; break;
    case 'name': orderBy.title = 'asc'; break;
    default: orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
  }
  
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        variants: { where: { isActive: true }, include: { inventory: true }, orderBy: { position: 'asc' } },
        category: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  
  const productsWithPricing = products.map(p => ({
    ...p,
    minPrice: p.variants.length > 0 ? Math.min(...p.variants.map(v => Number(v.price))) : Number(p.basePrice),
    totalStock: p.variants.reduce((sum, v) => sum + (v.inventory?.quantity || 0), 0),
    colors: [...new Set(p.variants.map(v => v.color).filter(Boolean))],
    sizes: [...new Set(p.variants.map(v => v.size).filter(Boolean))],
  }));
  
  res.json({
    products: productsWithPricing,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
});

productRoutes.get('/:id/stock', async (req, res) => {
  const { id } = req.params;

  // Accept either the product id or its handle.
  const product = await prisma.product.findFirst({
    where: { OR: [{ id }, { handle: id }] },
    select: {
      id: true,
      title: true,
      handle: true,
      variants: {
        where: { isActive: true },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          sku: true,
          color: true,
          size: true,
          inventory: {
            select: { quantity: true, reserved: true, lowStockThreshold: true, trackQuantity: true },
          },
        },
      },
    },
  });

  if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');

  const variants = product.variants.map((variant) => {
    const quantity = variant.inventory?.quantity ?? 0;
    const reserved = variant.inventory?.reserved ?? 0;
    const trackQuantity = variant.inventory?.trackQuantity ?? true;
    const available = trackQuantity ? Math.max(quantity - reserved, 0) : quantity;
    return {
      variantId: variant.id,
      sku: variant.sku,
      color: variant.color,
      size: variant.size,
      quantity,
      reserved,
      available,
      trackQuantity,
      lowStockThreshold: variant.inventory?.lowStockThreshold ?? 0,
      inStock: available > 0,
    };
  });

  res.json({
    productId: product.id,
    handle: product.handle,
    title: product.title,
    totalAvailable: variants.reduce((sum, v) => sum + (v.trackQuantity ? v.available : 0), 0),
    variants,
  });
});

productRoutes.get('/:handle', optionalAuth, async (req: AuthenticatedRequest, res) => {
  const { handle } = req.params;

  const [product, pageContent] = await Promise.all([
    prisma.product.findUnique({
      where: { handle, isActive: true },
      include: {
        images: { orderBy: { position: 'asc' } },
        variants: { where: { isActive: true }, include: { inventory: true, images: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
        category: true,
        collections: { include: { collection: true } },
        sizeChart: true,
        reviews: { where: { isApproved: true, isHidden: false }, include: { customer: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 10 },
      },
    }),
    // Per-product page copy (subtitle, fit notes, model, accordion sections) lives
    // in the CMS table, so the product model itself never needs a new column.
    prisma.cmsContent.findFirst({
      where: {
        key: `product-page:${handle}`,
        isActive: true,
        OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }],
      },
      select: { content: true },
    }),
  ]);

  if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');

  res.json({ product: { ...product, page: pageContent?.content ?? null } });
});

productRoutes.get('/meta/filters', async (_req, res) => {
  const [categories, priceRange] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true, parentId: null }, include: { children: { where: { isActive: true } } }, orderBy: { sortOrder: 'asc' } }),
    prisma.product.aggregate({ where: { isActive: true }, _min: { basePrice: true }, _max: { basePrice: true } }),
  ]);
  
  res.json({ categories, priceRange: { min: Number(priceRange._min.basePrice || 0), max: Number(priceRange._max.basePrice || 0) } });
});