import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { jsonField } from '../../utils/json';
import { logAdminActivity } from '../../utils/audit';
import { AuthenticatedRequest, adminAuthMiddleware, requirePermission } from '../../middleware/auth';

export const adminProductRoutes = Router();
adminProductRoutes.use(adminAuthMiddleware);

const productSchema = z.object({
  title: z.string().min(1).max(200),
  handle: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string(),
  shortDescription: z.string().optional(),
  sku: z.string().min(1).max(100),
  categoryId: z.string(),
  basePrice: z.number().positive(),
  compareAtPrice: z.number().positive().optional(),
  costPrice: z.number().positive().optional(),
  fabric: z.string().optional(),
  gsm: z.number().int().positive().optional(),
  fit: z.string().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isBestseller: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  sortBy: z.enum(['createdAt', 'title', 'basePrice']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

adminProductRoutes.get('/', requirePermission('products:read'), async (req: AuthenticatedRequest, res) => {
  const q = querySchema.parse(req.query);
  const where: any = {};
  if (q.search) where.OR = [{ title: { contains: q.search } }, { sku: { contains: q.search } }, { handle: { contains: q.search } }];
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.isActive !== undefined) where.isActive = q.isActive;
  if (q.isFeatured !== undefined) where.isFeatured = q.isFeatured;
  
  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { [q.sortBy]: q.sortOrder }, skip: (q.page - 1) * q.limit, take: q.limit, include: { category: { select: { id: true, name: true } }, images: { where: { isPrimary: true }, take: 1 }, variants: { include: { inventory: true } }, _count: { select: { reviews: true, orderItems: true } } } }),
    prisma.product.count({ where }),
  ]);
  res.json({ products, pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } });
});

adminProductRoutes.get('/:id', requirePermission('products:read'), async (req: AuthenticatedRequest, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { category: true, images: { orderBy: { position: 'asc' } }, variants: { include: { inventory: true, images: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } }, collections: { include: { collection: true } }, sizeChart: true },
  });
  if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
  res.json({ product });
});
adminProductRoutes.post('/', requirePermission('products:create'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = productSchema.parse(req.body);
  const existing = await prisma.product.findUnique({ where: { handle: data.handle } });
  if (existing) throw new AppError('Handle already exists', 409, 'HANDLE_EXISTS');
  
  const product = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data: { ...data, tags: jsonField(data.tags), createdById: adminId, updatedById: adminId } });
    const variant = await tx.productVariant.create({ data: { productId: product.id, sku: data.sku, title: data.title, price: data.basePrice, position: 0 } });
    await tx.inventory.create({ data: { productId: product.id, variantId: variant.id, quantity: 0, lowStockThreshold: 5 } });
    await logAdminActivity(
      tx,
      { adminId, action: 'PRODUCT_CREATE', entityType: 'Product', entityId: product.id, newData: product },
      req
    );
    return product;
  });
  res.status(201).json({ message: 'Product created', product });
});

adminProductRoutes.patch('/:id', requirePermission('products:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = productSchema.partial().parse(req.body);
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
  if (data.handle && data.handle !== product.handle) {
    const existing = await prisma.product.findUnique({ where: { handle: data.handle } });
    if (existing) throw new AppError('Handle already exists', 409, 'HANDLE_EXISTS');
  }
  const updated = await prisma.product.update({ where: { id: req.params.id }, data: { ...data, tags: data.tags ? jsonField(data.tags) : undefined, updatedById: adminId } });
  await logAdminActivity(
    prisma,
    { adminId, action: 'PRODUCT_UPDATE', entityType: 'Product', entityId: updated.id, newData: data },
    req
  );
  res.json({ message: 'Product updated', product: updated });
});

adminProductRoutes.delete('/:id', requirePermission('products:delete'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
  await prisma.$transaction(async (tx) => {
    await tx.product.delete({ where: { id: req.params.id } });
    await logAdminActivity(
      tx,
      { adminId, action: 'PRODUCT_DELETE', entityType: 'Product', entityId: req.params.id, oldData: product },
      req
    );
  });
  res.json({ message: 'Product deleted' });
});

adminProductRoutes.post('/bulk', requirePermission('products:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) throw new AppError('Product IDs required', 400, 'INVALID_IDS');
  
  let result;
  switch (action) {
    case 'publish': result = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isActive: true, updatedById: adminId } }); break;
    case 'unpublish': result = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isActive: false, updatedById: adminId } }); break;
    case 'feature': result = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isFeatured: true, updatedById: adminId } }); break;
    case 'unfeature': result = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isFeatured: false, updatedById: adminId } }); break;
    case 'delete': result = await prisma.product.deleteMany({ where: { id: { in: ids } } }); break;
    default: throw new AppError('Invalid action', 400, 'INVALID_ACTION');
  }
  await logAdminActivity(
    prisma,
    { adminId, action: `PRODUCT_BULK_${String(action).toUpperCase()}`, entityType: 'Product', newData: { ids, action } },
    req
  );
  res.json({ message: `Bulk ${action} completed`, count: result.count });
});

/* ------------------------------------------------------------------ *
 * Gallery, variants and size chart.
 *
 * The product page needs more than the product row can carry, and every piece
 * of it already has a home: ProductImage (optionally tied to one colour),
 * ProductVariant + Inventory, and SizeChart. These routes are the write side
 * the storefront reads back through GET /products/:handle.
 * ------------------------------------------------------------------ */

// An uploaded file lives under /api/v1/cms/media, a shipped asset under /assets,
// and the founder's own links are absolute https — nothing else gets rendered.
const mediaUrl = z.string().min(1).max(600).regex(/^(\/|https?:\/\/)/i, 'Use an uploaded file or a full https link');

const measures = z.record(z.union([z.number(), z.string().max(60)])).refine(
  (value) => Object.keys(value).length <= 30,
  'Too many sizes in one row'
);

const mediaItemSchema = z.object({
  id: z.string().optional(),
  url: mediaUrl,
  altText: z.string().max(200).optional(),
  type: z.string().min(1).max(30).default('image'),
  isPrimary: z.boolean().default(false),
  variantId: z.string().nullish(),
});

const mediaSchema = z.object({
  images: z.array(mediaItemSchema).max(40),
});

adminProductRoutes.put('/:id/media', requirePermission('products:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = mediaSchema.parse(req.body);

  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      images: { select: { id: true } },
      variants: { select: { id: true } },
    },
  });
  if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');

  const mine = new Set(product.images.map((image) => image.id));
  const colours = new Set(product.variants.map((variant) => variant.id));

  for (const item of data.images) {
    if (item.id && !mine.has(item.id)) {
      throw new AppError('That picture belongs to another product', 400, 'IMAGE_MISMATCH');
    }
    if (item.variantId && !colours.has(item.variantId)) {
      throw new AppError('That colour belongs to another product', 400, 'VARIANT_MISMATCH');
    }
  }

  const keep = new Set(data.images.filter((item) => item.id).map((item) => item.id as string));
  const drop = [...mine].filter((id) => !keep.has(id));
  const primaryIndex = data.images.findIndex((item) => item.isPrimary);
  const primaryPosition = primaryIndex === -1 ? 0 : primaryIndex;

  const images = await prisma.$transaction(async (tx) => {
    if (drop.length) await tx.productImage.deleteMany({ where: { id: { in: drop } } });

    const saved = [];
    for (let position = 0; position < data.images.length; position += 1) {
      const item = data.images[position];
      const fields = {
        url: item.url,
        altText: item.altText || null,
        type: item.type,
        position,
        // Ties the picture to one colour swatch; null shows it for every colour.
        variantId: item.variantId || null,
        isPrimary: position === primaryPosition,
      };
      saved.push(
        item.id
          ? await tx.productImage.update({ where: { id: item.id }, data: fields })
          : await tx.productImage.create({ data: { productId: product.id, ...fields } })
      );
    }

    // One primary per product, whichever row the admin did not tick.
    await tx.productImage.updateMany({
      where: { productId: product.id, id: { notIn: saved.map((image) => image.id) } },
      data: { isPrimary: false },
    });

    await logAdminActivity(
      tx,
      { adminId, action: 'PRODUCT_MEDIA_UPDATE', entityType: 'Product', entityId: product.id, newData: { kept: saved.length, removed: drop.length } },
      req
    );
    return saved;
  });

  res.json({ message: 'Gallery saved', images });
});

const variantItemSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  color: z.string().max(60).nullish(),
  size: z.string().max(60).nullish(),
  price: z.number().positive(),
  compareAtPrice: z.number().positive().nullish(),
  isActive: z.boolean().default(true),
  stock: z.number().int().min(0).max(100000).optional(),
  lowStockThreshold: z.number().int().min(0).max(1000).optional(),
});

const variantsSchema = z.object({ variants: z.array(variantItemSchema).min(1).max(200) });

adminProductRoutes.put('/:id/variants', requirePermission('products:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = variantsSchema.parse(req.body);

  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    select: { id: true, variants: { select: { id: true, sku: true } } },
  });
  if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');

  const mine = new Set(product.variants.map((variant) => variant.id));
  for (const item of data.variants) {
    if (item.id && !mine.has(item.id)) {
      throw new AppError('That variant belongs to another product', 400, 'VARIANT_MISMATCH');
    }
  }

  const skus = data.variants.map((variant) => variant.sku);
  if (new Set(skus).size !== skus.length) {
    throw new AppError('Two variants share the same SKU', 400, 'DUPLICATE_SKU');
  }
  const taken = await prisma.productVariant.findFirst({
    where: { sku: { in: skus }, NOT: { id: { in: [...mine] } } },
  });
  if (taken) {
    throw new AppError(`SKU ${taken.sku} is already used by ${taken.title}`, 409, 'SKU_TAKEN');
  }

  const variants = await prisma.$transaction(async (tx) => {
    const saved = [];
    for (let position = 0; position < data.variants.length; position += 1) {
      const item = data.variants[position];
      const fields = {
        sku: item.sku,
        title: item.title,
        color: item.color || null,
        size: item.size || null,
        price: item.price,
        compareAtPrice: item.compareAtPrice || null,
        isActive: item.isActive,
        position,
      };
      const variant = item.id
        ? await tx.productVariant.update({ where: { id: item.id }, data: fields })
        : await tx.productVariant.create({ data: { productId: product.id, ...fields } });

      // Stock is set from the product form; a fresh variant starts at zero.
      await tx.inventory.upsert({
        where: { variantId: variant.id },
        create: {
          productId: product.id,
          variantId: variant.id,
          quantity: item.stock ?? 0,
          lowStockThreshold: item.lowStockThreshold ?? 5,
        },
        update: {
          ...(item.stock === undefined ? {} : { quantity: item.stock }),
          ...(item.lowStockThreshold === undefined ? {} : { lowStockThreshold: item.lowStockThreshold }),
        },
      });

      saved.push(variant.id);
    }

    await logAdminActivity(
      tx,
      { adminId, action: 'PRODUCT_VARIANTS_UPDATE', entityType: 'Product', entityId: product.id, newData: { variantIds: saved } },
      req
    );

    return tx.productVariant.findMany({
      where: { id: { in: saved } },
      include: { inventory: true },
      orderBy: { position: 'asc' },
    });
  });

  res.json({ message: 'Variants saved', variants });
});

adminProductRoutes.delete('/:id/variants/:variantId', requirePermission('products:delete'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const variant = await prisma.productVariant.findUnique({
    where: { id: req.params.variantId },
    select: { id: true, productId: true, sku: true, title: true, _count: { select: { orderItems: true } } },
  });
  if (!variant || variant.productId !== req.params.id) {
    throw new AppError('Variant not found', 404, 'NOT_FOUND');
  }
  if (variant._count.orderItems > 0) {
    throw new AppError('This size has been ordered, so it stays on record. Switch it off instead.', 409, 'VARIANT_ORDERED');
  }

  const remaining = await prisma.productVariant.count({ where: { productId: variant.productId } });
  if (remaining <= 1) throw new AppError('A product needs at least one variant', 409, 'LAST_VARIANT');

  await prisma.$transaction(async (tx) => {
    // Inventory has no cascade guard of its own; remove it with the variant.
    await tx.inventory.deleteMany({ where: { variantId: variant.id } });
    await tx.productVariant.delete({ where: { id: variant.id } });
    await logAdminActivity(
      tx,
      { adminId, action: 'PRODUCT_VARIANT_DELETE', entityType: 'ProductVariant', entityId: variant.id, oldData: { sku: variant.sku, title: variant.title } },
      req
    );
  });

  res.json({ message: 'Variant removed' });
});

const chartSchema = z.object({
  type: z.enum(['TOPS', 'BOTTOMS', 'SETS', 'OUTERWEAR', 'ACCESSORIES']).default('TOPS'),
  unit: z.enum(['inches', 'cm']).default('inches'),
  chest: measures.nullish(),
  waist: measures.nullish(),
  hips: measures.nullish(),
  length: measures.nullish(),
  shoulder: measures.nullish(),
  sleeve: measures.nullish(),
  inseam: measures.nullish(),
  rise: measures.nullish(),
  thigh: measures.nullish(),
  customFields: z.record(z.string().max(400)).nullish(),
});

/**
 * SizeChart measurements are text columns that the read/write bridge in lib/prisma
 * parses back into objects, so a row is written as a JSON string. `undefined`
 * leaves a row alone and `null` clears it, which is exactly what the editor needs.
 * Accepts either a parsed request or a chart row already read from the database.
 */
interface ChartFields {
  type: string;
  unit: string;
  chest?: unknown;
  waist?: unknown;
  hips?: unknown;
  length?: unknown;
  shoulder?: unknown;
  sleeve?: unknown;
  inseam?: unknown;
  rise?: unknown;
  thigh?: unknown;
  customFields?: unknown;
}

function chartWrite(input: ChartFields) {
  const cell = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return jsonField(value);
  };
  return {
    type: input.type,
    unit: input.unit,
    chest: cell(input.chest),
    waist: cell(input.waist),
    hips: cell(input.hips),
    length: cell(input.length),
    shoulder: cell(input.shoulder),
    sleeve: cell(input.sleeve),
    inseam: cell(input.inseam),
    rise: cell(input.rise),
    thigh: cell(input.thigh),
    customFields: cell(input.customFields),
  };
}

adminProductRoutes.put('/:id/size-chart', requirePermission('products:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = chartSchema.parse(req.body);

  const product = await prisma.product.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');

  const fields = chartWrite(data);
  const chart = await prisma.sizeChart.upsert({
    where: { productId: product.id },
    create: { productId: product.id, ...fields },
    update: fields,
  });

  await logAdminActivity(
    prisma,
    { adminId, action: 'PRODUCT_SIZE_CHART_UPDATE', entityType: 'SizeChart', entityId: chart.id, newData: data },
    req
  );
  res.json({ message: 'Size chart saved', sizeChart: chart });
});

/**
 * One chart per product is a column we are not changing, so a category-wide
 * chart is written as a copy: same numbers, one row each.
 */
adminProductRoutes.post('/:id/size-chart/copy', requirePermission('products:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const source = await prisma.sizeChart.findUnique({ where: { productId: req.params.id } });
  if (!source) throw new AppError('This product has no size chart to copy', 404, 'NO_CHART');

  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    select: { id: true, categoryId: true },
  });
  if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');

  const siblings = await prisma.product.findMany({
    where: { categoryId: product.categoryId, id: { not: product.id } },
    select: { id: true },
  });

  const fields = chartWrite(source);

  await prisma.$transaction(async (tx) => {
    for (const sibling of siblings) {
      await tx.sizeChart.upsert({
        where: { productId: sibling.id },
        create: { productId: sibling.id, ...fields },
        update: fields,
      });
    }
    await logAdminActivity(
      tx,
      { adminId, action: 'PRODUCT_SIZE_CHART_COPY', entityType: 'Product', entityId: product.id, newData: { to: siblings.map((s) => s.id) } },
      req
    );
  });

  res.json({ message: `Chart applied to ${siblings.length} other product(s) in this category`, count: siblings.length });
});