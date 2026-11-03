import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { logAdminActivity } from '../../utils/audit';
import { AuthenticatedRequest, adminAuthMiddleware, requirePermission } from '../../middleware/auth';

/**
 * Review moderation for the admin dashboard.
 *
 * The `Review` model has no dedicated status column: moderation lives in
 * `isApproved` + `isHidden`, and the storefront only ever reads reviews with
 * `isApproved: true, isHidden: false`. So:
 *   APPROVE -> isApproved = true,  isHidden = false
 *   REJECT  -> isApproved = false, isHidden = true   (kept for the record)
 *   HIDE    -> isHidden = true, isApproved unchanged (delist without deleting)
 * No new columns were needed.
 */
export const adminReviewRoutes = Router();
adminReviewRoutes.use(adminAuthMiddleware);

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  productId: z.string().optional(),
  customerId: z.string().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  /** Moderation bucket; `pending` is the queue a moderator works through. */
  moderation: z.enum(['all', 'pending', 'approved', 'rejected', 'hidden']).default('pending'),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

function moderationWhere(moderation: z.infer<typeof querySchema>['moderation']) {
  switch (moderation) {
    case 'approved':
      return { isApproved: true, isHidden: false };
    case 'rejected':
      return { isApproved: false, isHidden: true };
    case 'hidden':
      return { isHidden: true };
    case 'pending':
      return { isApproved: false, isHidden: false };
    default:
      return {};
  }
}

adminReviewRoutes.get('/', requirePermission('reviews:read'), async (req: AuthenticatedRequest, res) => {
  const q = querySchema.parse(req.query);
  const where: any = { ...moderationWhere(q.moderation) };
  if (q.productId) where.productId = q.productId;
  if (q.customerId) where.customerId = q.customerId;
  if (q.rating) where.rating = q.rating;
  if (q.verifiedOnly !== undefined) where.isVerifiedPurchase = q.verifiedOnly;

  const [reviews, total, pendingCount] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        // No passwordHash / tokens: the dashboard only needs to identify the writer.
        customer: { select: { id: true, email: true, firstName: true, lastName: true } },
        product: { select: { id: true, title: true, handle: true } },
      },
      orderBy: { createdAt: q.sort === 'oldest' ? 'asc' : 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.review.count({ where }),
    prisma.review.count({ where: { isApproved: false, isHidden: false } }),
  ]);

  res.json({
    reviews,
    pendingCount,
    pagination: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
  });
});

adminReviewRoutes.get('/:id', requirePermission('reviews:read'), async (req: AuthenticatedRequest, res) => {
  const review = await prisma.review.findUnique({
    where: { id: req.params.id },
    include: {
      customer: { select: { id: true, email: true, firstName: true, lastName: true, totalOrders: true } },
      product: { select: { id: true, title: true, handle: true } },
    },
  });
  if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');
  res.json({ review });
});

const moderationSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'HIDE', 'UNHIDE']),
  adminReply: z.string().max(2000).optional(),
  note: z.string().max(2000).optional(),
});

function moderationData(action: z.infer<typeof moderationSchema>['action']) {
  switch (action) {
    case 'APPROVE':
      return { isApproved: true, isHidden: false };
    case 'REJECT':
      return { isApproved: false, isHidden: true };
    case 'HIDE':
      return { isHidden: true };
    case 'UNHIDE':
      return { isHidden: false };
  }
}

adminReviewRoutes.patch('/:id/moderation', requirePermission('reviews:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = moderationSchema.parse(req.body);

  const review = await prisma.review.findUnique({
    where: { id: req.params.id },
    select: { id: true, isApproved: true, isHidden: true, productId: true },
  });
  if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.review.update({
      where: { id: review.id },
      data: {
        ...moderationData(data.action),
        ...(data.adminReply
          ? { adminReply: data.adminReply, adminReplyAt: new Date(), adminReplyBy: adminId }
          : {}),
      },
    });

    await logAdminActivity(
      tx,
      {
        adminId,
        action: `REVIEW_${data.action}`,
        entityType: 'Review',
        entityId: review.id,
        oldData: { isApproved: review.isApproved, isHidden: review.isHidden },
        newData: { ...moderationData(data.action), adminReply: data.adminReply, note: data.note },
      },
      req
    );

    return result;
  });

  const messageByAction = { APPROVE: 'approved', REJECT: 'rejected', HIDE: 'hidden', UNHIDE: 'unhidden' } as const;
  res.json({ message: `Review ${messageByAction[data.action]}`, review: updated });
});

adminReviewRoutes.delete('/:id', requirePermission('reviews:delete'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;

  const review = await prisma.review.findUnique({
    where: { id: req.params.id },
    select: { id: true, productId: true, customerId: true, rating: true, content: true, isApproved: true },
  });
  if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');

  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id: review.id } });
    await logAdminActivity(
      tx,
      {
        adminId,
        action: 'REVIEW_DELETE',
        entityType: 'Review',
        entityId: review.id,
        oldData: {
          productId: review.productId,
          customerId: review.customerId,
          rating: review.rating,
          isApproved: review.isApproved,
          content: review.content,
        },
      },
      req
    );
  });

  res.json({ message: 'Review deleted' });
});
