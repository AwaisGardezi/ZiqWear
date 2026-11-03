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