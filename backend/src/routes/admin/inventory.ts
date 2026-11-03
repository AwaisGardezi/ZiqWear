import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { logAdminActivity } from '../../utils/audit';
import { AuthenticatedRequest, adminAuthMiddleware, requirePermission } from '../../middleware/auth';

export const adminInventoryRoutes = Router();
adminInventoryRoutes.use(adminAuthMiddleware);

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  productId: z.string().optional(),
  variantId: z.string().optional(),
  lowStock: z.coerce.boolean().optional(),
  outOfStock: z.coerce.boolean().optional(),
  sortBy: z.enum(['quantity', 'productTitle', 'updatedAt']).default('quantity'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

adminInventoryRoutes.get('/', requirePermission('inventory:read'), async (req: AuthenticatedRequest, res) => {
  const q = querySchema.parse(req.query);
  const where: any = {};
  if (q.productId) where.productId = q.productId;
  if (q.variantId) where.variantId = q.variantId;
  if (q.lowStock) where.quantity = { lte: 5, gt: 0 };
  if (q.outOfStock) where.quantity = { lte: 0 };
  
  const [inventory, total] = await Promise.all([
    prisma.inventory.findMany({ where, orderBy: { [q.sortBy]: q.sortOrder }, skip: (q.page - 1) * q.limit, take: q.limit, include: { product: { select: { id: true, title: true, handle: true, images: { where: { isPrimary: true }, take: 1 } } }, variant: { select: { id: true, title: true, color: true, size: true, sku: true } } } }),
    prisma.inventory.count({ where }),
  ]);
  res.json({ inventory, pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } });
});

const adjustSchema = z.object({
  variantId: z.string(),
  quantity: z.number().int(),
  reason: z.string().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
});

adminInventoryRoutes.post('/adjust', requirePermission('inventory:update'), async (req: AuthenticatedRequest, res) => {
  const adminId = req.user!.id;
  const data = adjustSchema.parse(req.body);
  
  const inventory = await prisma.inventory.findUnique({ where: { variantId: data.variantId } });
  if (!inventory) throw new AppError('Inventory not found', 404, 'NOT_FOUND');
  
  const newQuantity = Math.max(0, inventory.quantity + data.quantity);
  
  await prisma.$transaction(async (tx) => {
    await tx.inventory.update({ where: { id: inventory.id }, data: { quantity: newQuantity } });
    await tx.inventoryMovement.create({ data: { inventoryId: inventory.id, type: data.quantity > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', quantity: Math.abs(data.quantity), reason: data.reason || 'Manual adjustment', referenceType: data.referenceType, referenceId: data.referenceId, adminId } });
    await logAdminActivity(
      tx,
      {
        adminId,
        action: 'INVENTORY_ADJUST',
        entityType: 'Inventory',
        entityId: inventory.id,
        oldData: { quantity: inventory.quantity },
        newData: { quantity: newQuantity },
      },
      req
    );
  });
  
  res.json({ message: 'Inventory adjusted', newQuantity });
});

adminInventoryRoutes.get('/movements/:variantId', requirePermission('inventory:read'), async (req: AuthenticatedRequest, res) => {
  const inventory = await prisma.inventory.findUnique({ where: { variantId: req.params.variantId } });
  if (!inventory) throw new AppError('Inventory not found', 404, 'NOT_FOUND');
  
  const movements = await prisma.inventoryMovement.findMany({ where: { inventoryId: inventory.id }, orderBy: { createdAt: 'desc' }, take: 100, include: { admin: { select: { id: true, name: true } } } });
  res.json({ movements });
});