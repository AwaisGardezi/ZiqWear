import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { AuthenticatedRequest, adminAuthMiddleware, requirePermission } from '../../middleware/auth';

export const adminCollectionRoutes = Router();
adminCollectionRoutes.use(adminAuthMiddleware);

const collectionSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  image: z.string().optional(),
  bannerImage: z.string().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  publishAt: z.string().datetime().optional(),
  unpublishAt: z.string().datetime().optional(),
  sortOrder: z.number().int().default(0),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

adminCollectionRoutes.get('/', requirePermission('collections:read'), async (_req: AuthenticatedRequest, res) => {
  const collections = await prisma.collection.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
  });
  res.json({ collections });
});

adminCollectionRoutes.post('/', requirePermission('collections:create'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = collectionSchema.parse(req.body);
  const existing = await prisma.collection.findUnique({ where: { slug: data.slug } });
  if (existing) throw new AppError('Slug already exists', 409, 'SLUG_EXISTS');
  
  const collection = await prisma.collection.create({ data: { ...data, publishAt: data.publishAt ? new Date(data.publishAt) : null, unpublishAt: data.unpublishAt ? new Date(data.unpublishAt) : null } });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'COLLECTION_CREATE', entityType: 'Collection', entityId: collection.id, newData: JSON.stringify(collection) } });
  res.status(201).json({ message: 'Collection created', collection });
});

adminCollectionRoutes.patch('/:id', requirePermission('collections:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = collectionSchema.partial().parse(req.body);
  const collection = await prisma.collection.findUnique({ where: { id: req.params.id } });
  if (!collection) throw new AppError('Collection not found', 404, 'NOT_FOUND');
  if (data.slug && data.slug !== collection.slug) {
    const existing = await prisma.collection.findUnique({ where: { slug: data.slug } });
    if (existing) throw new AppError('Slug already exists', 409, 'SLUG_EXISTS');
  }
  const updated = await prisma.collection.update({ where: { id: req.params.id }, data: { ...data, publishAt: data.publishAt ? new Date(data.publishAt) : undefined, unpublishAt: data.unpublishAt ? new Date(data.unpublishAt) : undefined } });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'COLLECTION_UPDATE', entityType: 'Collection', entityId: updated.id, newData: JSON.stringify(data) } });
  res.json({ message: 'Collection updated', collection: updated });
});

adminCollectionRoutes.delete('/:id', requirePermission('collections:delete'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  await prisma.collection.delete({ where: { id: req.params.id } });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'COLLECTION_DELETE', entityType: 'Collection', entityId: req.params.id } });
  res.json({ message: 'Collection deleted' });
});

adminCollectionRoutes.post('/:id/products', requirePermission('collections:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const { productIds, sortOrder } = req.body;
  await prisma.$transaction(async (tx) => {
    await tx.productCollection.deleteMany({ where: { collectionId: req.params.id } });
    if (productIds?.length) {
      await tx.productCollection.createMany({ data: productIds.map((id: string, i: number) => ({ productId: id, collectionId: req.params.id, sortOrder: sortOrder?.[i] ?? i })) });
    }
  });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'COLLECTION_PRODUCTS_UPDATE', entityType: 'Collection', entityId: req.params.id, newData: JSON.stringify({ productIds }) } });
  res.json({ message: 'Collection products updated' });
});