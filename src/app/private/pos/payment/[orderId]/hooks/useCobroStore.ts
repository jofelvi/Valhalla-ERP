import { create } from 'zustand';
import { PaymentMethodEnum } from '@odin6/types';
import type { Dispatch, SetStateAction } from 'react';
import type { Order } from '@/modelTypes/order';
import type { CardPaymentEntry, PagoMovilFormData } from '../components';

/**
 * Estado EFÍMERO de la pantalla de cobro (una orden). Vive en Zustand por
 * decisión del dueño (13/09/2026). Como mueve dinero, el store se blinda contra
 * que valores de una orden sangren hacia la siguiente con TRES candados:
 *
 *  1. `crearEstadoInicial()` es la ÚNICA fuente del estado vacío. `reset()` lo
 *     aplica entero, así que un campo nuevo se limpia solo con solo agregarlo
 *     aquí — nunca hay que acordarse de sumarlo a un reset a mano.
 *  2. `ensureOrder(orderId)` resetea por IDENTIDAD, no a mano: si el orderId del
 *     store no coincide con el de la pantalla, purga todo y fija el nuevo. Abrir
 *     otra orden deja el store en cero aunque el componente no se desmonte.
 *  3. SIN `persist`: solo memoria. Un F5 arranca limpio desde React Query, nunca
 *     desde dinero cacheado en el navegador.
 *
 * Lo DERIVABLE (totales, subtotales, cliente) NO vive aquí: se calcula con
 * useMemo en la pantalla. Los cálculos puros de dinero siguen en `@odin6/types`
 * y `features/pos/cobro.ts`.
 */
interface CobroData {
  /** Orden dueña del estado actual. `ensureOrder` lo usa para resetear. */
  orderId: string | null;

  // ── División de cuenta ────────────────────────────────────────────────
  /** Modo "dividir cuenta": se cobra solo una selección parcial de ítems. */
  splitMode: boolean;
  /** index de ítem → cantidad seleccionada para esta división. */
  splitSelection: Map<number, number>;

  // ── Tarjetas ──────────────────────────────────────────────────────────
  /** Pagos con tarjeta capturados (puede haber varios: monto + referencia). */
  cardPayments: CardPaymentEntry[];

  // ── Edición de ítems ──────────────────────────────────────────────────
  /**
   * Ítem marcado para borrar (index dentro de order.items + su nombre). El
   * index se resuelve contra la orden ACTUAL al confirmar; por eso vive aquí y
   * no como estado local: si cambia la orden, `ensureOrder` lo purga y evita
   * borrar el ítem equivocado de otra orden.
   */
  itemToDelete: { index: number; name: string } | null;
  /** Modal de confirmación de borrado abierto. */
  showDeleteConfirm: boolean;

  // ── Métodos de pago y montos (money-core) ─────────────────────────────
  /** Métodos elegidos para este cobro (puede ser mixto). */
  selectedPaymentMethods: PaymentMethodEnum[];
  /** Monto capturado por método (string del input). Es LO QUE SE COBRA. */
  paymentAmounts: Record<PaymentMethodEnum, string>;
  /** Referencia por método (tarjeta, transferencia). */
  paymentReferences: Record<PaymentMethodEnum, string>;

  // ── Pago Móvil ────────────────────────────────────────────────────────
  showPagoMovilModal: boolean;
  pagoMovilMode: 'manual' | 'auto';
  pagoMovilData: PagoMovilFormData;

  // ── Propina ───────────────────────────────────────────────────────────
  /**
   * tipAmount NO se deriva a propósito: los prefill guardan el USD EXACTO de la
   * orden (`order.tipAmount`), mientras `customTipBs` es `tipBs.toFixed(2)`.
   * Derivar tipAmount de customTipBs reintroduciría una reconversión Bs→USD que
   * puede diferir de ese exacto. Se mueve como estado, idéntico al original.
   */
  tipAmount: number;
  selectedTip: number | null;
  customTipBs: string;
  showCustomTip: boolean;
}

interface CobroActions {
  /**
   * Ancla el store a una orden. Si cambió respecto a la anterior, resetea todo
   * el estado efímero antes de fijar el nuevo orderId. Idempotente: llamarlo con
   * el mismo orderId no toca nada.
   */
  ensureOrder: (orderId: string) => void;
  /** Purga el estado efímero a su valor inicial (mantiene orderId en null). */
  reset: () => void;

  // ── División de cuenta ────────────────────────────────────────────────
  toggleSplitMode: (order: Order | undefined) => void;
  setSplitSelection: Dispatch<SetStateAction<Map<number, number>>>;
  handleSplitToggleItem: (index: number, maxQty: number) => void;
  handleSplitQtyChange: (index: number, qty: number, maxQty: number) => void;

  // ── Tarjetas ──────────────────────────────────────────────────────────
  setCardPayments: Dispatch<SetStateAction<CardPaymentEntry[]>>;
  addCardPayment: () => void;
  /**
   * Quita la tarjeta `index`. Si era la última, restaura una fila vacía y
   * deselecciona el método CARD (ambos viven en el store).
   */
  removeCardPayment: (index: number) => void;
  updateCardPayment: (
    index: number,
    field: keyof CardPaymentEntry,
    value: string,
  ) => void;

  // ── Edición de ítems ──────────────────────────────────────────────────
  /** Marca un ítem para borrar y abre el modal de confirmación. */
  askDeleteItem: (item: { index: number; name: string }) => void;
  /** Cierra el modal y limpia el ítem marcado. */
  clearDeleteItem: () => void;

  // ── Métodos de pago y montos (money-core) ─────────────────────────────
  setSelectedPaymentMethods: Dispatch<SetStateAction<PaymentMethodEnum[]>>;
  setPaymentAmounts: Dispatch<
    SetStateAction<Record<PaymentMethodEnum, string>>
  >;
  setPaymentReferences: Dispatch<
    SetStateAction<Record<PaymentMethodEnum, string>>
  >;

  // ── Pago Móvil ────────────────────────────────────────────────────────
  setShowPagoMovilModal: Dispatch<SetStateAction<boolean>>;
  setPagoMovilMode: Dispatch<SetStateAction<'manual' | 'auto'>>;
  setPagoMovilData: Dispatch<SetStateAction<PagoMovilFormData>>;

  // ── Propina ───────────────────────────────────────────────────────────
  setTipAmount: Dispatch<SetStateAction<number>>;
  setSelectedTip: Dispatch<SetStateAction<number | null>>;
  setCustomTipBs: Dispatch<SetStateAction<string>>;
  setShowCustomTip: Dispatch<SetStateAction<boolean>>;
}

export type CobroState = CobroData & CobroActions;

/**
 * Fábrica del estado vacío. Es una función (no un objeto literal compartido)
 * para que cada reset entregue un `Map` FRESCO y no una referencia reutilizada
 * que podría mutarse por accidente entre órdenes.
 */
/** Record vacío con TODAS las llaves de método (mismo literal que el original). */
const crearMontosVacios = (): Record<PaymentMethodEnum, string> => ({
  [PaymentMethodEnum.CASH_BS]: '',
  [PaymentMethodEnum.CASH_USD]: '',
  [PaymentMethodEnum.CARD]: '',
  [PaymentMethodEnum.TRANSFER]: '',
  [PaymentMethodEnum.PAGO_MOVIL]: '',
  [PaymentMethodEnum.PAGO_MOVIL_MANUAL]: '',
  [PaymentMethodEnum.MIXED]: '',
  [PaymentMethodEnum.PENDING]: '',
  [PaymentMethodEnum.PAYROLL_DEDUCTION]: '',
});

const crearEstadoInicial = (): CobroData => ({
  orderId: null,
  splitMode: false,
  splitSelection: new Map(),
  cardPayments: [{ amount: '', reference: '' }],
  itemToDelete: null,
  showDeleteConfirm: false,
  selectedPaymentMethods: [],
  paymentAmounts: crearMontosVacios(),
  paymentReferences: crearMontosVacios(),
  showPagoMovilModal: false,
  pagoMovilMode: 'manual',
  pagoMovilData: {
    amount: '',
    reference: '',
    phone: '',
    cedula: '',
    banco: '',
    fechaPago: new Date().toISOString().split('T')[0], // YYYY-MM-DD, hoy por defecto
  },
  tipAmount: 0,
  selectedTip: null,
  customTipBs: '',
  showCustomTip: false,
});

export const useCobroStore = create<CobroState>((set, get) => ({
  ...crearEstadoInicial(),

  ensureOrder: (orderId) => {
    if (get().orderId === orderId) return;
    // Candado 2: cambió la orden → purga TODO y fija el nuevo id en un solo set.
    set({ ...crearEstadoInicial(), orderId });
  },

  reset: () => set(crearEstadoInicial()),

  // ── División de cuenta ──────────────────────────────────────────────────
  toggleSplitMode: (order) => {
    const { splitMode } = get();
    if (!splitMode && order) {
      // Al activar, seleccionar todos los ítems con su cantidad completa.
      const allSelected = new Map<number, number>();
      order.items.forEach((item, index) => {
        allSelected.set(index, item.quantity);
      });
      set({ splitSelection: allSelected });
    }
    set({ splitMode: !splitMode });
  },

  setSplitSelection: (value) =>
    set((state) => ({
      splitSelection:
        typeof value === 'function' ? value(state.splitSelection) : value,
    })),

  handleSplitToggleItem: (index, maxQty) =>
    set((state) => {
      const next = new Map(state.splitSelection);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.set(index, maxQty);
      }
      return { splitSelection: next };
    }),

  handleSplitQtyChange: (index, qty, maxQty) =>
    set((state) => {
      const next = new Map(state.splitSelection);
      if (qty <= 0) {
        next.delete(index);
      } else {
        next.set(index, Math.min(qty, maxQty));
      }
      return { splitSelection: next };
    }),

  // ── Tarjetas ──────────────────────────────────────────────────────────
  setCardPayments: (value) =>
    set((state) => ({
      cardPayments:
        typeof value === 'function' ? value(state.cardPayments) : value,
    })),

  addCardPayment: () =>
    set((state) => ({
      cardPayments: [...state.cardPayments, { amount: '', reference: '' }],
    })),

  removeCardPayment: (index) =>
    set((state) => {
      const next = state.cardPayments.filter((_, i) => i !== index);
      if (next.length === 0) {
        // Se quitaron todas: queda una fila vacía y se deselecciona CARD.
        return {
          cardPayments: [{ amount: '', reference: '' }],
          selectedPaymentMethods: state.selectedPaymentMethods.filter(
            (m) => m !== PaymentMethodEnum.CARD,
          ),
        };
      }
      return { cardPayments: next };
    }),

  updateCardPayment: (index, field, value) =>
    set((state) => ({
      cardPayments: state.cardPayments.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry,
      ),
    })),

  // ── Edición de ítems ────────────────────────────────────────────────────
  askDeleteItem: (item) => set({ itemToDelete: item, showDeleteConfirm: true }),

  clearDeleteItem: () => set({ itemToDelete: null, showDeleteConfirm: false }),

  // ── Métodos de pago y montos (money-core) ─────────────────────────────
  // Setters que replican exactamente la semántica de useState (aceptan valor
  // directo o función actualizadora) para que los call-sites de page.tsx no
  // cambien: solo se sustituye de dónde vienen `x`/`setX`.
  setSelectedPaymentMethods: (value) =>
    set((state) => ({
      selectedPaymentMethods:
        typeof value === 'function'
          ? value(state.selectedPaymentMethods)
          : value,
    })),

  setPaymentAmounts: (value) =>
    set((state) => ({
      paymentAmounts:
        typeof value === 'function' ? value(state.paymentAmounts) : value,
    })),

  setPaymentReferences: (value) =>
    set((state) => ({
      paymentReferences:
        typeof value === 'function' ? value(state.paymentReferences) : value,
    })),

  // ── Pago Móvil ────────────────────────────────────────────────────────
  setShowPagoMovilModal: (value) =>
    set((state) => ({
      showPagoMovilModal:
        typeof value === 'function' ? value(state.showPagoMovilModal) : value,
    })),

  setPagoMovilMode: (value) =>
    set((state) => ({
      pagoMovilMode:
        typeof value === 'function' ? value(state.pagoMovilMode) : value,
    })),

  setPagoMovilData: (value) =>
    set((state) => ({
      pagoMovilData:
        typeof value === 'function' ? value(state.pagoMovilData) : value,
    })),

  // ── Propina ───────────────────────────────────────────────────────────
  setTipAmount: (value) =>
    set((state) => ({
      tipAmount: typeof value === 'function' ? value(state.tipAmount) : value,
    })),

  setSelectedTip: (value) =>
    set((state) => ({
      selectedTip:
        typeof value === 'function' ? value(state.selectedTip) : value,
    })),

  setCustomTipBs: (value) =>
    set((state) => ({
      customTipBs:
        typeof value === 'function' ? value(state.customTipBs) : value,
    })),

  setShowCustomTip: (value) =>
    set((state) => ({
      showCustomTip:
        typeof value === 'function' ? value(state.showCustomTip) : value,
    })),
}));
