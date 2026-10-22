import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, CartItem } from '../types';

interface CartState {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, notes?: string) => void;
  removeItem: (target: string | number) => void;
  updateQuantity: (target: string | number, quantity: number) => void;
  updateNotes: (target: string | number, notes: string) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product: Product, quantity = 1, notes?: string) => {
        set((state) => {
          const normalizedNewNotes = notes?.trim() || undefined;
          const existingItemIndex = state.items.findIndex(
            (item) =>
              item.product.id === product.id &&
              !item.composition &&
              (item.notes?.trim() || undefined) === normalizedNewNotes,
          );

          if (existingItemIndex >= 0) {
            return {
              items: state.items.map((item, idx) =>
                idx === existingItemIndex
                  ? { ...item, quantity: item.quantity + quantity }
                  : item,
              ),
            };
          }

          return {
            items: [
              ...state.items,
              { product, quantity, notes: normalizedNewNotes },
            ],
          };
        });
      },

      removeItem: (target: string | number) => {
        set((state) => ({
          items: state.items.filter((item, idx) =>
            typeof target === 'number'
              ? idx !== target
              : item.product.id !== target,
          ),
        }));
      },

      updateQuantity: (target: string | number, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(target);
          return;
        }

        set((state) => ({
          items: state.items.map((item, idx) => {
            const matches =
              typeof target === 'number'
                ? idx === target
                : item.product.id === target;
            return matches ? { ...item, quantity } : item;
          }),
        }));
      },

      updateNotes: (target: string | number, notes: string) => {
        set((state) => ({
          items: state.items.map((item, idx) => {
            const matches =
              typeof target === 'number'
                ? idx === target
                : item.product.id === target;
            return matches ? { ...item, notes } : item;
          }),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      getSubtotal: () => {
        const { items } = get();
        return items.reduce(
          (sum, item) => sum + item.product.price * item.quantity,
          0,
        );
      },

      getTotal: () => {
        return get().getSubtotal();
      },

      getItemCount: () => {
        const { items } = get();
        return items.reduce((sum, item) => sum + item.quantity, 0);
      },
    }),
    {
      name: 'pos-cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
