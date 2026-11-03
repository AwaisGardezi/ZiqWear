import { describe, it, expect } from 'vitest';
import { restoreOrderStock, type RestockItem } from '../src/services/inventory';

/**
 * Order-deletion restock tests.
 *
 * `POST /api/orders/delete` (src/routes/legacy.ts) returns sold stock to each
 * variant by calling `restoreOrderStock` with the order's items, keyed on the
 * order id. These tests drive that same primitive against an in-memory ledger —
 * hermetic, like every other backend test, with no Prisma or Express.
 */

interface FakeRow {
  id: string;
  variantId: string;
  quantity: number;
}

interface MovementRow {
  inventoryId: string;
  type: string;
  quantity: number;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  adminId?: string | null;
}

/** Minimal stand-in for the Prisma `inventory` / `inventoryMovement` client. */
function makeFakeDb(inventoryRows: FakeRow[]) {
  const inventory = inventoryRows.map((row) => ({ ...row }));
  const movements: MovementRow[] = [];

  const db = {
    inventory: {
      async findUnique({ where }: any) {
        return inventory.find((row) => row.variantId === where.variantId) ?? null;
      },
      async update({ where, data }: any) {
        const row = inventory.find((r) => r.variantId === where.variantId);
        if (!row) throw new Error('inventory row vanished');
        row.quantity += data.quantity.increment ?? 0;
        return row;
      },
    },
    inventoryMovement: {
      async findMany({ where }: any) {
        return movements.filter(
          (m) =>
            m.inventoryId === where.inventoryId &&
            (where.type?.in ?? []).includes(m.type) &&
            m.referenceType === where.referenceType &&
            m.referenceId === where.referenceId
        );
      },
      async create({ data }: any) {
        const row: MovementRow = {
          inventoryId: data.inventoryId,
          type: data.type,
          quantity: data.quantity,
          reason: data.reason ?? null,
          referenceType: data.referenceType ?? null,
          referenceId: data.referenceId ?? null,
          adminId: data.adminId ?? null,
        };
        movements.push(row);
        return row;
      },
    },
  };

  return {
    db,
    quantityOf: (variantId: string) =>
      inventory.find((r) => r.variantId === variantId)?.quantity,
    restockMovements: () =>
      movements.filter((m) => ['CANCELLED', 'RETURN', 'REFUND'].includes(m.type)),
  };
}

// The order sold 3 units of v1 (stock 13 -> 10) and 2 of v2 (stock 5 -> 3).
function soldOrder() {
  const fake = makeFakeDb([
    { id: 'inv-1', variantId: 'v1', quantity: 10 },
    { id: 'inv-2', variantId: 'v2', quantity: 3 },
  ]);
  const items: RestockItem[] = [
    { variantId: 'v1', quantity: 3 },
    { variantId: 'v2', quantity: 2 },
  ];
  return { ...fake, items };
}

function deleteOptions(orderId = 'order-1') {
  return {
    movementType: 'CANCELLED',
    reason: 'Order deleted',
    referenceId: orderId,
    orderNumber: 'ZQ-123456',
  };
}

describe('order deletion restock (restoreOrderStock)', () => {
  it('returns every sold variant its full quantity on delete', async () => {
    const { db, items, quantityOf, restockMovements } = soldOrder();

    const restored = await restoreOrderStock(db, items, deleteOptions());

    expect(restored).toBe(5);
    expect(quantityOf('v1')).toBe(13); // 10 + 3 back on the shelf
    expect(quantityOf('v2')).toBe(5); // 3 + 2
    expect(restockMovements()).toHaveLength(2);
  });

  it('is idempotent: a second delete does not restock again', async () => {
    const { db, items, quantityOf, restockMovements } = soldOrder();

    const first = await restoreOrderStock(db, items, deleteOptions());
    const second = await restoreOrderStock(db, items, deleteOptions());

    expect(first).toBe(5);
    expect(second).toBe(0);
    expect(quantityOf('v1')).toBe(13);
    expect(quantityOf('v2')).toBe(5);
    // Still one movement per line — the ledger guard suppressed the replay.
    expect(restockMovements()).toHaveLength(2);
  });

  it('does not double-restock an order that was already cancelled', async () => {
    const { db, items, quantityOf } = soldOrder();

    // Cancel path files the restock under CANCELLED for the same order id...
    await restoreOrderStock(db, items, {
      ...deleteOptions(),
      movementType: 'CANCELLED',
      reason: 'Order cancelled',
    });
    // ...so a later delete finds nothing left to return.
    const afterDelete = await restoreOrderStock(db, items, deleteOptions());

    expect(afterDelete).toBe(0);
    expect(quantityOf('v1')).toBe(13);
    expect(quantityOf('v2')).toBe(5);
  });

  it('skips lines the creation path never decremented (no variant / untracked)', async () => {
    const { db, quantityOf, restockMovements } = makeFakeDb([
      { id: 'inv-1', variantId: 'v1', quantity: 10 },
    ]);
    const items: RestockItem[] = [
      { variantId: 'v1', quantity: 3 },
      { variantId: null, quantity: 4 }, // no variant -> never tracked
      { variantId: 'v-missing', quantity: 1 }, // no inventory row -> untracked
    ];

    const restored = await restoreOrderStock(db, items, deleteOptions());

    expect(restored).toBe(3);
    expect(quantityOf('v1')).toBe(13);
    expect(restockMovements()).toHaveLength(1);
  });
});
