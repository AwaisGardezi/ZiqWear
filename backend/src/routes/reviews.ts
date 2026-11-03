import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { jsonField } from '../utils/json';
import { AuthenticatedRequest, authMiddleware, optionalAuth } from '../middleware/auth';

export const reviewRoutes = Router();

/**
 * Anti-spam guard for the public write surface. The whole `/api` tree already
 * runs through the global limiter in `app.ts` (100 requests / 15 min / IP);
 * review submission gets its own, much tighter bucket, same mechanism.
 */
export const reviewSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reviews submitted from this device, please try again later' },
});

const createReviewSchema = z.object({
  productId: z.string().min(1),
  orderId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(100).optional(),
  content: z.string().min(10).max(5000),
  pros: z.string().max(500).optional(),
  cons: z.string().max(500).optional(),
  fitRating: z.number().int().min(1).max(5).optional(),
  qualityRating: z.number().int().min(1).max(5).optional(),
  valueRating: z.number().int().min(1).max(5).optional(),
  images: z.array(z.string().url()).max(5).optional(),
  /** Only used when the reviewer is not signed in (guest verified-purchase flow). */
  authorEmail: z.string().email().optional(),
  authorPhone: z.string().min(7).max(20).optional(),
});

/** Fields a reviewer may change on their own pending review. */
const updateReviewSchema = createReviewSchema.omit({ productId: true, orderId: true, authorEmail: true, authorPhone: true }).partial();

/** Order statuses that prove the reviewer actually received the product. */
const COMPLETED_STATUSES = ['DELIVERED'];

function phoneCandidates(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return [];
  // The storefront stores phones in several shapes ("03001234567",
  // "+923001234567", "3001234567"), so match on the last 10 digits like the
  // order-tracking lookup does.
  return Array.from(new Set([digits, digits.slice(-10)]));
}

interface VerifiedMatch {
  order: { id: string; orderNumber: string; status: string } | null;
  orderItemId: string | null;
}

/**
 * Verified-purchase check.
 *
 * A review is only marked verified when a COMPLETED (delivered) order that
 * contains the product exists and is addressed to the reviewer: either the
 * order row is linked to their customer id, or its `email` / `phone` matches
 * the identity they signed in with (or supplied as a guest). Nothing is
 * claimed beyond what the Order/OrderItem rows actually say.
 */
async function findVerifiedPurchase(
  identity: { customerId?: string | null; email?: string | null; phone?: string | null },
  productId: string,
  orderId?: string
): Promise<VerifiedMatch> {
  const phoneForms = phoneCandidates(identity.phone);

  const ownerMatches: any[] = [];
  if (identity.customerId) ownerMatches.push({ customerId: identity.customerId });
  if (identity.email) ownerMatches.push({ email: identity.email.toLowerCase() });
  if (phoneForms.length) ownerMatches.push({ phone: { contains: phoneForms[phoneForms.length - 1] } });

  if (!ownerMatches.length) return { order: null, orderItemId: null };

  const order = await prisma.order.findFirst({
    where: {
      status: { in: COMPLETED_STATUSES },
      ...(orderId ? { id: orderId } : {}),
      AND: [{ OR: ownerMatches }],
      items: { some: { productId } },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      items: { where: { productId }, select: { id: true }, take: 1 },
    },
  });

  if (!order) return { order: null, orderItemId: null };
  const { items, ...meta } = order;
  return { order: meta, orderItemId: items[0]?.id ?? null };
}

// Get product reviews — PUBLIC (mounted without auth so shoppers can read them)
reviewRoutes.get('/product/:productId', async (req, res) => {
  const { productId } = req.params;
  const query = z
    .object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(50).default(10),
      rating: z.coerce.number().int().min(1).max(5).optional(),
      verifiedOnly: z.coerce.boolean().optional().default(false),
      sort: z.enum(['newest', 'oldest', 'helpful', 'ratingDesc', 'ratingAsc']).default('newest'),
    })
    .parse(req.query);

  // Moderation columns actually on the Review model: isApproved / isHidden.
  const where: any = { productId, isApproved: true, isHidden: false };
  if (query.rating) where.rating = query.rating;
  if (query.verifiedOnly) where.isVerifiedPurchase = true;

  const orderBy: Record<string, 'asc' | 'desc'> =
    query.sort === 'oldest'
      ? { createdAt: 'asc' }
      : query.sort === 'helpful'
        ? { helpfulCount: 'desc' }
        : query.sort === 'ratingDesc'
          ? { rating: 'desc' }
          : query.sort === 'ratingAsc'
            ? { rating: 'asc' }
            : { createdAt: 'desc' };

  const [reviews, total, summary] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: [orderBy, { createdAt: query.sort === 'oldest' ? 'asc' : 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      // Public projection: internal ids (customerId / orderId / orderItemId) are
      // not needed by the storefront and would let the moderation queue be walked.
      select: {
        id: true,
        productId: true,
        rating: true,
        title: true,
        content: true,
        pros: true,
        cons: true,
        fitRating: true,
        qualityRating: true,
        valueRating: true,
        images: true,
        isVerifiedPurchase: true,
        helpfulCount: true,
        adminReply: true,
        adminReplyAt: true,
        createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.review.count({ where }),
    prisma.review.aggregate({
      where: { productId, isApproved: true, isHidden: false },
      _avg: { rating: true, fitRating: true, qualityRating: true, valueRating: true },
      _count: true,
    }),
  ]);

  const ratingDistribution = await prisma.review.groupBy({
    by: ['rating'],
    where: { productId, isApproved: true, isHidden: false },
    _count: true,
  });

  res.json({
    reviews,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
    summary: {
      averageRating: summary._avg.rating || 0,
      totalReviews: summary._count,
      avgFit: summary._avg.fitRating,
      avgQuality: summary._avg.qualityRating,
      avgValue: summary._avg.valueRating,
      distribution: ratingDistribution,
    },
  });
});

// Public counter used by the product page "write a review" affordance.
reviewRoutes.get('/product/:productId/count', async (req, res) => {
  const where = { productId: req.params.productId, isApproved: true, isHidden: false };
  const [total, verified] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.count({ where: { ...where, isVerifiedPurchase: true } }),
  ]);
  res.json({ total, verified });
});

// Submit a review.
//
// Signed-in customers review against their own account. Guests are matched to
// a delivered order by email/phone: because `Review.customerId` is a required
// foreign key, a guest can only review something they can actually be linked
// to, which doubles as the anti-fake guard for the public endpoint.
reviewRoutes.post('/', reviewSubmitLimiter, optionalAuth, async (req: AuthenticatedRequest, res) => {
  const data = createReviewSchema.parse(req.body);

  const product = await prisma.product.findUnique({
    where: { id: data.productId },
    select: { id: true, isActive: true },
  });
  if (!product || !product.isActive) throw new AppError('Product not found', 404, 'NOT_FOUND');

  let email = req.customer?.email ?? data.authorEmail?.toLowerCase() ?? null;
  const phone = req.customer?.phone ?? data.authorPhone ?? null;
  let customerId = req.customer?.id ?? null;

  if (!customerId) {
    if (!email && !phone) {
      throw new AppError(
        'Sign in, or provide the email or phone number used on your order',
        401,
        'REVIEW_IDENTITY_REQUIRED'
      );
    }
    const or: any[] = [];
    if (email) or.push({ email });
    const candidates = phoneCandidates(phone);
    if (candidates.length) or.push({ phone: { contains: candidates[candidates.length - 1] } });

    const existing = await prisma.customer.findFirst({ where: { OR: or }, select: { id: true, email: true, phone: true } });
    if (!existing) {
      throw new AppError(
        'No account matches those details. Sign in to review a purchase.',
        403,
        'REVIEW_ACCOUNT_NOT_FOUND'
      );
    }
    customerId = existing.id;
    // Use the account's stored email so the order match is exact.
    email = existing.email;
  }

  // One review per customer per product; PATCH is the way to change it afterwards.
  const already = await prisma.review.findFirst({
    where: { productId: data.productId, customerId },
    select: { id: true },
  });
  if (already) throw new AppError('You have already reviewed this product', 409, 'ALREADY_REVIEWED');

  const match = await findVerifiedPurchase(
    { customerId, email: email ?? req.customer?.email ?? null, phone },
    data.productId,
    data.orderId
  );

  const review = await prisma.review.create({
    data: {
      productId: data.productId,
      customerId,
      orderId: match.order?.id ?? data.orderId ?? null,
      orderItemId: match.orderItemId,
      rating: data.rating,
      title: data.title,
      content: data.content,
      pros: data.pros,
      cons: data.cons,
      fitRating: data.fitRating,
      qualityRating: data.qualityRating,
      valueRating: data.valueRating,
      images: jsonField(data.images || []),
      // Only ever true when a delivered order really contains this product.
      isVerifiedPurchase: Boolean(match.order),
      isApproved: false,
    },
  });

  res.status(201).json({
    message: match.order
      ? 'Verified purchase review submitted for moderation'
      : 'Review submitted for moderation (not verified against a delivered order)',
    review,
    verifiedPurchase: Boolean(match.order),
    verifiedOrderNumber: match.order?.orderNumber ?? null,
  });
});

// Update own review
reviewRoutes.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const customerId = req.customer!.id;
  const { id } = req.params;

  const review = await prisma.review.findFirst({
    where: { id, customerId },
    select: { id: true, productId: true },
  });
  if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');

  const data = updateReviewSchema.parse(req.body ?? {});
  const { images, ...rest } = data;

  // Re-check verification: the delivered order may have landed after the review
  // was first written, so the flag is recomputed from the order table.
  const match = await findVerifiedPurchase(
    { customerId, email: req.customer!.email, phone: req.customer!.phone },
    review.productId
  );

  const updated = await prisma.review.update({
    where: { id: review.id },
    data: {
      ...rest,
      ...(images ? { images: jsonField(images) } : {}),
      isVerifiedPurchase: Boolean(match.order),
      // Editing the substance of a review sends it back through moderation, so
      // an approved row cannot be silently rewritten into something else.
      ...('rating' in rest || 'content' in rest || 'title' in rest ? { isApproved: false } : {}),
    },
  });

  res.json({ review: updated });
});

// Delete own review
reviewRoutes.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const customerId = req.customer!.id;
  const { id } = req.params;

  // Ownership is resolved with findFirst (Prisma's `delete` only accepts a
  // unique where clause), then the row is removed by its primary key.
  const review = await prisma.review.findFirst({ where: { id, customerId }, select: { id: true } });
  if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');

  await prisma.review.delete({ where: { id: review.id } });
  res.json({ message: 'Review deleted' });
});

// Mark a review helpful (public, per-IP rate limited to keep it from being farmed)
reviewRoutes.post('/:id/helpful', reviewSubmitLimiter, async (req, res) => {
  const review = await prisma.review.findFirst({
    where: { id: req.params.id, isApproved: true, isHidden: false },
    select: { id: true, helpfulCount: true },
  });
  if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');

  const updated = await prisma.review.update({
    where: { id: review.id },
    data: { helpfulCount: { increment: 1 } },
    select: { id: true, helpfulCount: true },
  });
  res.json(updated);
});

// Get customer reviews
reviewRoutes.get('/my-reviews', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const customerId = req.customer!.id;
  const reviews = await prisma.review.findMany({
    where: { customerId },
    include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ reviews });
});