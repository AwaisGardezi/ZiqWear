import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { AuthenticatedRequest, adminAuthMiddleware, requirePermission } from '../../middleware/auth';

export const adminCategoryRoutes = Router();
adminCategoryRoutes.use(adminAuthMiddleware);

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  image: z.string().optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

adminCategoryRoutes.get('/', requirePermission('categories:read'), async (_req: AuthenticatedRequest, res) => {
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    include: { children: { where: { isActive: true }, include: { children: true }, orderBy: { sortOrder: 'asc' } }, _count: { select: { products: { where: { isActive: true } } } } },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ categories });
});

adminCategoryRoutes.post('/', requirePermission('categories:create'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = categorySchema.parse(req.body);
  const existing = await prisma.category.findUnique({ where: { slug: data.slug } });
  if (existing) throw new AppError('Slug already exists', 409, 'SLUG_EXISTS');
  
  const category = await prisma.category.create({ data: { ...data, createdById: adminId } });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'CATEGORY_CREATE', entityType: 'Category', entityId: category.id, newData: JSON.stringify(category) } });
  res.status(201).json({ message: 'Category created', category });
});

adminCategoryRoutes.patch('/:id', requirePermission('categories:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = categorySchema.partial().parse(req.body);
  const category = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!category) throw new AppError('Category not found', 404, 'NOT_FOUND');
  if (data.slug && data.slug !== category.slug) {
    const existing = await prisma.category.findUnique({ where: { slug: data.slug } });
    if (existing) throw new AppError('Slug already exists', 409, 'SLUG_EXISTS');
  }
  const updated = await prisma.category.update({ where: { id: req.params.id }, data });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'CATEGORY_UPDATE', entityType: 'Category', entityId: updated.id, newData: JSON.stringify(data) } });
  res.json({ message: 'Category updated', category: updated });
});

adminCategoryRoutes.delete('/:id', requirePermission('categories:delete'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  await prisma.category.delete({ where: { id: req.params.id } });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'CATEGORY_DELETE', entityType: 'Category', entityId: req.params.id } });
  res.json({ message: 'Category deleted' });
});