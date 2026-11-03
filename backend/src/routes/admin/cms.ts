import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { jsonField } from '../../utils/json';
import { contentUpload, contentImageUrl } from '../../lib/upload';
import { AuthenticatedRequest, adminAuthMiddleware, requirePermission } from '../../middleware/auth';

export const adminCmsRoutes = Router();
adminCmsRoutes.use(adminAuthMiddleware);

const cmsSchema = z.object({
  key: z.string().min(1).max(100),
  type: z.string().min(1).max(50),
  title: z.string().optional(),
  content: z.any(),
  isActive: z.boolean().default(true),
  publishAt: z.string().datetime().optional(),
  unpublishAt: z.string().datetime().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

adminCmsRoutes.get('/', requirePermission('cms:read'), async (req: AuthenticatedRequest, res) => {
  const q = querySchema.parse(req.query);
  const where: any = {};
  if (q.type) where.type = q.type;
  if (q.isActive !== undefined) where.isActive = q.isActive;
  
  const [contents, total] = await Promise.all([
    prisma.cmsContent.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
    prisma.cmsContent.count({ where }),
  ]);
  res.json({ contents, pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } });
});

/**
 * Publish an image the admin picked — the founder's own photo, a campaign shot —
 * and hand back the public URL to store in a content block. The file lands in the
 * uploads/content folder only, so it can never expose a payment proof.
 */
adminCmsRoutes.post(
  '/upload',
  requirePermission('cms:create', 'cms:update'),
  (req, res, next) => contentUpload(req, res, (err: unknown) => (err ? next(err) : next())),
  async (req: any, res) => {
    if (!req.file) {
      throw new AppError('Choose an image file to upload', 400, 'IMAGE_REQUIRED');
    }
    res.status(201).json({
      filename: req.file.filename as string,
      url: contentImageUrl(req.file.filename as string),
    });
  }
);

adminCmsRoutes.post('/', requirePermission('cms:create'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = cmsSchema.parse(req.body);
  
  const existing = await prisma.cmsContent.findUnique({ where: { key: data.key } });
  if (existing) throw new AppError('Key already exists', 409, 'KEY_EXISTS');
  
  const content = await prisma.cmsContent.create({ data: { ...data, content: jsonField(data.content), publishAt: data.publishAt ? new Date(data.publishAt) : null, unpublishAt: data.unpublishAt ? new Date(data.unpublishAt) : null } });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'CMS_CREATE', entityType: 'CmsContent', entityId: content.id, newData: JSON.stringify(content) } });
  res.status(201).json({ message: 'Content created', content });
});

adminCmsRoutes.patch('/:id', requirePermission('cms:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = cmsSchema.partial().parse(req.body);
  
  const content = await prisma.cmsContent.findUnique({ where: { id: req.params.id } });
  if (!content) throw new AppError('Content not found', 404, 'NOT_FOUND');
  
  if (data.key && data.key !== content.key) {
    const existing = await prisma.cmsContent.findUnique({ where: { key: data.key } });
    if (existing) throw new AppError('Key already exists', 409, 'KEY_EXISTS');
  }
  
  const updated = await prisma.cmsContent.update({ where: { id: req.params.id }, data: { ...data, content: jsonField(data.content), publishAt: data.publishAt ? new Date(data.publishAt) : undefined, unpublishAt: data.unpublishAt ? new Date(data.unpublishAt) : undefined } });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'CMS_UPDATE', entityType: 'CmsContent', entityId: updated.id, newData: JSON.stringify(data) } });
  res.json({ message: 'Content updated', content: updated });
});

adminCmsRoutes.delete('/:id', requirePermission('cms:delete'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  await prisma.cmsContent.delete({ where: { id: req.params.id } });
  await prisma.adminActivityLog.create({ data: { adminId, action: 'CMS_DELETE', entityType: 'CmsContent', entityId: req.params.id } });
  res.json({ message: 'Content deleted' });
});