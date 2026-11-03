import { AppError } from '../utils/AppError';

/**
 * Inventory integrity for order creation.
 *
 * Shared by `routes/orders.ts` (v1 API) and `routes/legacy.ts` (old
 * storefront) so both decrement stock and write an audit row the same way.
 * The whole operation runs inside the caller's Prisma transaction so stock
 * never drifts from the order row, and oversell is rejected with a 409.
 */

export interface OrderStockLine {
  productId: string;
  variantId?: string | null;
  /** Human-readable product name, used in the oversell message. */
  productTitle: string;
  /** Optional variant descriptor (e.g. "Black / L") for the oversell message. */
  variantLabel?: string | null;
  quantity: number;
}

export interface CommitStockOptions {
  referenceType?: string;
  referenceId?: string | null;
  /** Label shown in InventoryMovement.reason, e.g. the order number. */
  referenceLabel?: string | null;
  /** Attributed admin for the movement, when an admin placed the order. */
  adminId?: string | null;
  movementType?: string;
}

type StockClient = {
  inventory: {
    findUnique: (args: any) => Promise<any>;
    updateMany: (args: any) => Promise<{ count: number }>;
  };
  inventoryMovement: {
    create: (args: any) => Promise<unknown>;
  };
};

export interface RestockItem {
  variantId?: string | null;
  /** Units this call wants to put back. */
  quantity: number;
  /**
   * Upper bound of units that ever left stock for this order line. Defaults to
   * `quantity` (full-line restock, e.g. a cancel). Partial flows — returns and
   * partial refunds — pass the original sold quantity so repeated partial calls
   * can never restock more than the order actually took out.
   */
  maxQuantity?: number;
}

export interface RestockOptions {
  /** InventoryMovement.type, e.g. 'CANCELLED' | 'RETURN' | 'REFUND'. */
  movementType: string;
  /** Human-readable cause written to InventoryMovement.reason. */
  reason: string;
  /** Order id stored as InventoryMovement.referenceId (and used as the ledger key). */
  referenceId: string;
  referenceType?: string;
  /** Order number, appended to the reason for operator legibility. */
  orderNumber?: string | null;
  /** Extra context appended to the reason, e.g. the return request id. */
  referenceLabel?: string | null;
  adminId?: string | null;
}

type RestockClient = {
  inventory: {
    findUnique: (args: any) => Promise<any>;
    update: (args: any) => Promise<unknown>;
  };
  inventoryMovement: {
    findMany: (args: any) => Promise<Array<{ quantity: number | string }>>;
    create: (args: any) => Promise<unknown>;
  };
};

function variantDisplayName(line: OrderStockLine): string {
  return line.variantLabel ? `${line.productTitle} (${line.variantLabel})` : line.productTitle;
}

/**
 * Decrement available stock for each order line and write one
 * InventoryMovement row per line. Throws a 409 naming the product/variant on
 * oversell. Lines without a variant (no Inventory row) are skipped.
 *
 * IMPORTANT: call this with the same `tx` that creates the order so the
 * decrement, the movement rows and the order are atomic.
 */
export async function commitOrderStock(
  db: StockClient,
  lines: OrderStockLine[],
  opts: CommitStockOptions = {}
): Promise<void> {
  const referenceType = opts.referenceType ?? 'Order';

  for (const line of lines) {
    if (!line.variantId || line.quantity <= 0) continue;

    const inventory = await db.inventory.findUnique({ where: { variantId: line.variantId } });

    // No inventory row means the variant is not stock-tracked; leave it alone.
    if (!inventory) continue;

    const available = inventory.quantity - (inventory.reserved ?? 0);
    if (available < line.quantity) {
      throw new AppError(
        `${variantDisplayName(line)} only has ${Math.max(available, 0)} in stock (requested ${line.quantity})`,
        409,
        'INSUFFICIENT_STOCK',
        {
          productId: line.productId,
          variantId: line.variantId,
          available: Math.max(available, 0),
          requested: line.quantity,
        }
      );
    }

    // Guarded decrement: only succeeds if quantity is still sufficient, so a
    // concurrent request cannot push stock negative.
    const decrement = await db.inventory.updateMany({
      where: { variantId: line.variantId, quantity: { gte: line.quantity } },
      data: { quantity: { decrement: line.quantity } },
    });

    if (decrement.count === 0) {
      throw new AppError(
        `${variantDisplayName(line)} just went out of stock`,
        409,
        'INSUFFICIENT_STOCK',
        { productId: line.productId, variantId: line.variantId, requested: line.quantity }
      );
    }

    await db.inventoryMovement.create({
      data: {
        inventoryId: inventory.id,
        type: opts.movementType ?? 'SALE',
        quantity: line.quantity,
        reason: opts.referenceLabel
          ? `Order ${opts.referenceLabel}`
          : 'Order placed',
        referenceType,
        referenceId: opts.referenceId ?? undefined,
        adminId: opts.adminId ?? undefined,
      },
    });
  }
}

/**
 * Movement types that represent stock coming back, and the order statuses that
 * trigger it. `restoreOrderStock` counts every type, so a cancel followed by a
 * refund on the same order cannot restock the same units twice.
 */
export const RESTOCK_MOVEMENT_TYPES = ['CANCELLED', 'RETURN', 'REFUND'] as const;
export const RESTOCKING_STATUSES = ['CANCELLED', 'RETURNED', 'REFUNDED'] as const;

/**
 * Symmetric counterpart of `commitOrderStock`.
 *
 * Every stock *increase* (customer cancel, admin cancel/refund/return) must
 * write an `InventoryMovement` row, otherwise the ledger only ever shows the
 * `SALE` side and stock changes silently. This helper:
 *  - increments the tracked `Inventory.quantity` per order line,
 *  - writes one movement row per line with the given type/reason/order reference,
 *  - is idempotent per (variant, order): the units already returned for that
 *    order are summed from the ledger first, so replaying a status PATCH — or a
 *    cancel followed by an admin refund — cannot restock the same units twice.
 *
 * Lines without a variant (no Inventory row) and lines whose product is not
 * stock-tracked are skipped, exactly like `commitOrderStock`.
 *
 * Returns the total units moved, so callers can log/report it.
 */
export async function restoreOrderStock(
  db: RestockClient,
  items: RestockItem[],
  opts: RestockOptions
): Promise<number> {
  const referenceType = opts.referenceType ?? 'Order';
  let restored = 0;

  for (const item of items) {
    if (!item.variantId || item.quantity <= 0) continue;

    const inventory = await db.inventory.findUnique({ where: { variantId: item.variantId } });
    if (!inventory) continue;

    // How many units of this variant have already been returned for this order
    // under ANY restock movement type (idempotency guard). Counting all types,
    // not just the current one, is what stops a customer cancel followed by an
    // admin refund from putting the same units back twice.
    const previous = await db.inventoryMovement.findMany({
      where: {
        inventoryId: inventory.id,
        type: { in: [...RESTOCK_MOVEMENT_TYPES] },
        referenceType,
        referenceId: opts.referenceId,
      },
      select: { quantity: true },
    });
    const alreadyReturned = previous.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const ceiling = item.maxQuantity ?? item.quantity;
    const remaining = Math.max(0, Math.min(item.quantity, ceiling - alreadyReturned));
    if (remaining <= 0) continue;

    await db.inventory.update({
      where: { variantId: item.variantId },
      data: { quantity: { increment: remaining } },
    });

    const reasonParts = [opts.reason];
    if (opts.orderNumber) reasonParts.push(`Order ${opts.orderNumber}`);
    if (opts.referenceLabel) reasonParts.push(opts.referenceLabel);

    await db.inventoryMovement.create({
      data: {
        inventoryId: inventory.id,
        type: opts.movementType,
        quantity: remaining,
        reason: reasonParts.join(' - '),
        referenceType,
        referenceId: opts.referenceId,
        adminId: opts.adminId ?? undefined,
      },
    });

    restored += remaining;
  }

  return restored;
}

/**
 * Shared truth for which order statuses should put stock back on the shelf,
 * used by the customer cancel route, the admin status route and the legacy
 * status endpoint so all three agree.
 */
export function isRestockingStatus(status: string): boolean {
  return (RESTOCKING_STATUSES as readonly string[]).includes(status);
}

/** Which InventoryMovement.type a given order status restock should be filed under. */
export function restockMovementTypeFor(status: string): string {
  if (status === 'RETURNED') return 'RETURN';
  if (status === 'REFUNDED') return 'REFUND';
  return 'CANCELLED';
}

export default commitOrderStock;
