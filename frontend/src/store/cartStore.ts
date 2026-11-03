import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, Product, ProductVariant } from '../types';

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  loading: boolean;
  subtotal: number;
  itemCount: number;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (product: Product, variant?: ProductVariant, quantity?: number) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearCart: () => Promise<void>;
  calculateTotals: () => void;
}

function itemKey(productId: string, variantId?: string) {
  return `${productId}::${variantId || 'default'}`;
}

/**
 * The cart lives in the browser. It works for guests as well as signed-in
 * customers, and is sent to the API only when the order is placed.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      loading: false,
      subtotal: 0,
      itemCount: 0,

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      addItem: async (product, variant, quantity = 1) => {
        const unitPrice = Number(variant?.price ?? product.basePrice);
        const id = itemKey(product.id, variant?.id);
        const items = [...get().items];
        const existing = items.find((item) => item.id === id);

        if (existing) {
          existing.quantity += quantity;
          existing.totalPrice = existing.unitPrice * existing.quantity;
        } else {
          items.push({
            id,
            productId: product.id,
            variantId: variant?.id,
            quantity,
            product,
            variant,
            unitPrice,
            totalPrice: unitPrice * quantity,
          });
        }

        set({ items, isOpen: true });
        get().calculateTotals();
      },

      updateQuantity: async (id, quantity) => {
        if (quantity <= 0) {
          await get().removeItem(id);
          return;
        }

        const items = get().items.map((item) =>
          item.id === id
            ? { ...item, quantity, totalPrice: item.unitPrice * quantity }
            : item
        );
        set({ items });
        get().calculateTotals();
      },

      removeItem: async (id) => {
        set({ items: get().items.filter((item) => item.id !== id) });
        get().calculateTotals();
      },

      clearCart: async () => {
        set({ items: [] });
        get().calculateTotals();
      },

      calculateTotals: () => {
        const items = get().items;
        set({
          subtotal: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
          itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        });
      },
    }),
    {
      name: 'ziqwear-cart',
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.calculateTotals();
      },
    }
  )
);
