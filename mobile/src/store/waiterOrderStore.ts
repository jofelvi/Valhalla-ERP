import { create } from 'zustand';
import type {
  Product,
  CartItem,
  CartItemComposition,
  ZoneSectorEnum,
} from '../types/index.ts';

interface WaiterOrderState {
  tableId: string;
  tableName: string;
  sector: ZoneSectorEnum | null;
  items: CartItem[];
  notes: string;
  isTakeaway: boolean;
  setTable: (tableId: string, tableName: string) => void;
  setSector: (sector: ZoneSectorEnum) => void;
  setTakeaway: (value: boolean) => void;
  addItem: (product: Product, quantity?: number, notes?: string) => void;
  // Tobos mixtos: agrega un tobo compuesto como línea propia (no se fusiona).
  addComposedItem: (
    product: Product,
    presentationQty: number,
    composition: CartItemComposition[],
    notes?: string,
  ) => void;
  removeItem: (target: string | number) => void;
  updateQuantity: (target: string | number, quantity: number) => void;
  setNotes: (notes: string) => void;
  setItemNotes: (target: string | number, notes: string) => void;
  getSubtotal: () => number;
  getTotal: () => number;
  getItemCount: () => number;
  clearOrder: () => void;
}

export const useWaiterOrderStore = create<WaiterOrderState>((set, get) => ({
  tableId: '',
  tableName: '',
  sector: null,
  items: [],
  notes: '',
  isTakeaway: false,

  setTable: (tableId: string, tableName: string) => {
    set({ tableId, tableName, sector: null });
  },

  setSector: (sector: ZoneSectorEnum) => {
    set({ sector, tableId: '', tableName: '' });
  },

  setTakeaway: (value: boolean) => {
    set({ isTakeaway: value });
  },

  addItem: (product: Product, quantity = 1, notes?: string) => {
    // Pack products (tobos, cajas): en el carrito se cuentan como "packs" (1 tobo,
    // 2 tobos…). La expansión a unidades individuales ocurre al crear la orden.
    const packQty =
      (product.presentationQuantity ?? 0) > 0
        ? product.presentationQuantity!
        : undefined;

    set((state) => {
      // Regla de no-fusión: si la línea tiene notas distintas, crear línea separada
      // para que la cocina distinga preparaciones personalizadas.
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
          { product, quantity, notes: normalizedNewNotes, presentationQty: packQty },
        ],
      };
    });
  },

  addComposedItem: (
    product: Product,
    presentationQty: number,
    composition: CartItemComposition[],
    notes?: string,
  ) => {
    // Cada tobo compuesto es su propia línea (mezclas distintas no se fusionan).
    set((state) => ({
      items: [
        ...state.items,
        { product, quantity: 1, notes, presentationQty, composition },
      ],
    }));
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

  setNotes: (notes: string) => {
    set({ notes });
  },

  setItemNotes: (target: string | number, notes: string) => {
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

  clearOrder: () => {
    set({
      tableId: '',
      tableName: '',
      sector: null,
      items: [],
      notes: '',
      isTakeaway: false,
    });
  },
}));
