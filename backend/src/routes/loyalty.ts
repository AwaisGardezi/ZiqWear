import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

export const loyaltyRoutes = Router();

// Get loyalty account
loyaltyRoutes.get('/account', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const customerId = req.customer!.id;
  
  const account = await prisma.loyaltyAccount.findUnique({
    where: { customerId },
    include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
  
  if (!account) {
    // Create if not exists
    const newAccount = await prisma.loyaltyAccount.create({ data: { customerId, tier: 'SILVER' } });
    res.json({ account: newAccount });
    return;
  }
  

  const referrals = await prisma.referral.findMany({
    where: { referrerId: customerId },
    include: { referred: { select: { firstName: true, lastName: true, email: true, createdAt: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ account: { ...account, referrals } });
});

// Get tier benefits
loyaltyRoutes.get('/tiers', async (_req, res) => {
  const tiers = {
    SILVER: { name: 'Silver', minPoints: 0, benefits: ['Earn 1 point per PKR spent', 'Birthday bonus: 5,000 points', 'Referral bonus: 1,000 points'] },
    GOLD: { name: 'Gold', minPoints: 50000, benefits: ['Earn 1.25 points per PKR spent', 'Birthday bonus: 7,500 points', 'Referral bonus: 1,500 points', 'Free shipping on all orders', 'Early access to new drops'] },
    BLACK: { name: 'Black', minPoints: 200000, benefits: ['Earn 1.5 points per PKR spent', 'Birthday bonus: 10,000 points', 'Referral bonus: 2,000 points', 'Free express shipping', 'VIP early access', 'Exclusive Black tier products', 'Personal styling session'] },
  };
  
  res.json({ tiers });
});

// Redeem points
loyaltyRoutes.post('/redeem', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const customerId = req.customer!.id;
  const { points, rewardId } = req.body;
  
  const account = await prisma.loyaltyAccount.findUnique({ where: { customerId } });
  if (!account) throw new AppError('Loyalty account not found', 404, 'NOT_FOUND');
  
  if (account.pointsBalance < points) throw new AppError('Insufficient points', 400, 'INSUFFICIENT_POINTS');
  
  // TODO: Validate reward exists and is available
  
  await prisma.$transaction([
    prisma.loyaltyAccount.update({
      where: { customerId },
      data: { pointsBalance: { decrement: points }, totalRedeemed: { increment: points }, lastActivityAt: new Date() },
    }),
    prisma.loyaltyTransaction.create({
      data: { accountId: account.id, type: 'REDEMPTION', points: -points, balance: account.pointsBalance - points, description: `Redeemed ${points} points`, referenceType: 'REWARD', referenceId: rewardId },
    }),
  ]);
  
  res.json({ message: 'Points redeemed successfully', pointsRemaining: account.pointsBalance - points });
});