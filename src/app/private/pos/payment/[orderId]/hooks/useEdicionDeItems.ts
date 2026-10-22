import { Order } from '@/modelTypes/order';
import type { LineaDeOrden } from '@odin6/types';
import { useTarifas } from '@/shared/config';
import { useNominaConfig } from '@/features/payroll/hooks/useNominaConfig';
import {
  calcularTotalesOrden,
  tasasGuardadasDe,
} from '@/features/pos/services/totalesOrden';
import { useCobroStore } from './useCobroStore';

interface UpdateOrderData {
  items: Order['items'];
  subtotal: number;
  serviceCharge: number;
  tax: number;
  total: number;
  updatedAt: Date;
}

interface UseEdicionDeItemsArgs {
  order: Order | undefined;
  updateOrder: {
    mutateAsync: (vars: {
      id: string;
      data: UpdateOrderData;
    }) => Promise<unknown>;
  };
  toast: {
    error: (o: { title: string; description: string }) => void;
    success: (o: { title: string; description: string }) => void;
  };
}

interface UseEdicionDeItemsReturn {
  showDeleteConfirm: boolean;
  itemToDelete: { index: number; name: string } | null;
  handleUpdateQuantity: (
    itemIndex: number,
    newQuantity: number,
  ) => Promise<void>;
  handleRemoveItem: (itemIndex: number) => void;
  confirmDeleteItem: () => Promise<void>;
  cancelDeleteItem: () => void;
}

/**
 * Orquesta la edición de ítems del cobro (cambiar cantidad / borrar). El ESTADO
 * del modal de borrado (itemToDelete/showDeleteConfirm) vive en useCobroStore
 * para que `ensureOrder` lo resetee al cambiar de orden. Los EFECTOS (mutación
 * de la orden + toasts) se quedan aquí porque necesitan las instancias de React
 * Query y del toast, que no pueden vivir dentro del store.
 */
export function useEdicionDeItems({
  order,
  updateOrder,
  toast,
}: UseEdicionDeItemsArgs): UseEdicionDeItemsReturn {
  const itemToDelete = useCobroStore((s) => s.itemToDelete);
  const showDeleteConfirm = useCobroStore((s) => s.showDeleteConfirm);
  const askDeleteItem = useCobroStore((s) => s.askDeleteItem);
  const clearDeleteItem = useCobroStore((s) => s.clearDeleteItem);
  const tarifas = useTarifas();
  const nomina = useNominaConfig();

  const handleUpdateQuantity = async (
    itemIndex: number,
    newQuantity: number,
  ) => {
    if (!order || newQuantity < 0) return;

    const updatedItems = [...order.items];
    if (newQuantity === 0) {
      updatedItems.splice(itemIndex, 1);
    } else {
      // Actualizar cantidad
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        quantity: newQuantity,
      };
    }

    // Un solo modelo de dinero (`@odin6/types`), con las tasas de la configuración o
    // las guardadas en la orden. Nunca una suma de `unitPrice * quantity`: se perdian
    // los descuentos aprobados con PIN y las cortesias, y ese total mal calculado se
    // PERSISTIA.
    const totales = calcularTotalesOrden({
      items: updatedItems as unknown as LineaDeOrden[],
      tieneMesonero: !!order.waiterId,
      tarifas,
      nomina,
      guardadas: tasasGuardadasDe(order),
    });

    try {
      await updateOrder.mutateAsync({
        id: order.id,
        data: {
          items: updatedItems,
          subtotal: totales.subtotal,
          serviceCharge: totales.serviceCharge,
          tax: totales.tax,
          total: totales.total,
          updatedAt: new Date(),
        },
      });
      // No se toca estado local: `order` viene de useOrder() y React Query
      // refresca por invalidacion. Aqui habia un `setOrder(...)` que no existia
      // en el modulo — lanzaba ReferenceError en cada edicion y este mismo
      // `catch` vacio se lo tragaba. Compilaba por `ignoreBuildErrors: true`.
    } catch (e) {
      toast.error({
        title: 'No se pudo actualizar la orden',
        description: e instanceof Error ? e.message : 'Intenta de nuevo.',
      });
    }
  };

  const handleRemoveItem = (itemIndex: number) => {
    if (!order) return;

    const item = order.items[itemIndex];
    if (item) {
      askDeleteItem({ index: itemIndex, name: item.name });
    }
  };

  const confirmDeleteItem = async () => {
    if (itemToDelete) {
      await handleUpdateQuantity(itemToDelete.index, 0);

      toast.success({
        title: 'Producto eliminado',
        description: `${itemToDelete.name} ha sido eliminado de la orden`,
      });
    }

    clearDeleteItem();
  };

  const cancelDeleteItem = () => {
    clearDeleteItem();
  };

  return {
    showDeleteConfirm,
    itemToDelete,
    handleUpdateQuantity,
    handleRemoveItem,
    confirmDeleteItem,
    cancelDeleteItem,
  };
}
