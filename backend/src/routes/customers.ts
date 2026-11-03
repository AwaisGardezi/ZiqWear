import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

export const customerRoutes = Router();

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().regex(/^(\+92|0)?3\d{9}$/).optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  marketingOptIn: z.boolean().optional(),
});

const addressSchema = z.object({
  type: z.enum(['shipping', 'billing']).default('shipping'),
  firstName: z.string(),
  lastName: z.string(),
  company: z.string().optional(),
  addressLine1: z.string(),
  addressLine2: z.string().optional(),
  city: z.string(),
  province: z.string(),
  postalCode: z.string().optional(),
  country: z.string().default('Pakistan'),
  phone: z.string().optional(),
  isDefault: z.boolean().default(false),
});

// Get profile
customerRoutes.get('/profile', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.customer!.id },
    select: {
      id: true, email: true, phone: true, firstName: true, lastName: true,
      dateOfBirth: true, gender: true, isVerified: true, marketingOptIn: true,
      totalSpent: true, totalOrders: true, createdAt: true,
      loyaltyAccount: { select: { tier: true, pointsBalance: true, lifetimePoints: true } },
    },
  });
  res.json({ customer });
});

// Update profile
customerRoutes.patch('/profile', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const data = updateProfileSchema.parse(req.body);
  
  const customer = await prisma.customer.update({
    where: { id: req.customer!.id },
    data,
    select: { id: true, email: true, phone: true, firstName: true, lastName: true, dateOfBirth: true, gender: true, marketingOptIn: true },
  });
  
  res.json({ customer });
});

// Get addresses
customerRoutes.get('/addresses', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const addresses = await prisma.address.findMany({
    where: { customerId: req.customer!.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  res.json({ addresses });
});

// Add address
customerRoutes.post('/addresses', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const data = addressSchema.parse(req.body);
  
  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { customerId: req.customer!.id, isDefault: true },
      data: { isDefault: false },
    });
  }
  
  const address = await prisma.address.create({
    data: { ...data, customerId: req.customer!.id },
  });
  
  res.status(201).json({ address });
});

// Update address
customerRoutes.patch('/addresses/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const data = addressSchema.partial().parse(req.body);
  
  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { customerId: req.customer!.id, isDefault: true },
      data: { isDefault: false },
    });
  }
  
  const address = await prisma.address.update({
    where: { id: req.params.id, customerId: req.customer!.id },
    data,
  });
  
  res.json({ address });
});

// Delete address
customerRoutes.delete('/addresses/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  await prisma.address.delete({ where: { id: req.params.id, customerId: req.customer!.id } });
  res.json({ message: 'Address deleted' });
});