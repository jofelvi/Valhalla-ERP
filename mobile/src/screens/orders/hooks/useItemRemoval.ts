import { useState, useCallback } from 'react';
import { Order } from '../../../types';
import { ApiError } from '../../../services/api/apiClient';
import { orderService } from '../../../services';
import { toApiOrderItem } from '../../../services/orderItemPayload';
import { showAlert } from '../../../utils/alert';
import { useModal } from '../../../hooks/useModal';
import { useTarifas } from '../../../config/hooks';
import { tarifasDeOrden } from '../../../config/tarifasDeOrden';
import { totalesDeOrden } from '../../../config/totalesDeOrden';

export const useItemRemoval = (order: Order | null, orderId: string) => {
  const tarifasVigentes = useTarifas();
  const itemPinModal = useModal('orderDetailItemPin');
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(
    null,
  );
  const [itemPinValue, setItemPinValue] = useState('');
  const [itemPinReason, setItemPinReason] = useState('');
  const [itemPinError, setItemPinError] = useState('');
  const [isAuthorizingItem, setIsAuthorizingItem] = useState(false);

  const removeItemAt = useCallback(
    async (itemIndex: number, editAuth?: { pin: string; reason: string }) => {
      if (!order) return;
      const updatedItems = order.items.filter((_, i) => i !== itemIndex);
      const hasWaiter = !!order.waiterId;
      // Las tarifas de la orden guardada mandan; si no las tiene, las vigentes.
      const t = totalesDeOrden(
        updatedItems,
        hasWaiter,
        tarifasDeOrden(order, tarifasVigentes),
      );

      await orderService.updateOrder(orderId, {
        items: updatedItems.map(toApiOrderItem),
        subtotal: t.subtotal,
        serviceCharge: t.serviceCharge,
        total: t.total,
        updatedAt: new Date(),
        ...(editAuth
          ? { editPin: editAuth.pin, editReason: editAuth.reason }
          : {}),
      });
    },
    [order, orderId, tarifasVigentes],
  );

  const handleRemoveItem = useCallback(
    (itemIndex: number) => {
      if (!order) return;
      const item = order.items[itemIndex];
      const itemName =
        item.productName || `Producto #${item.productId.slice(-5)}`;

      // Item ya comandado (sentQty>0): abre el modal PIN+motivo. Correcciones
      // de items aún no enviados a cocina/barra siguen con el confirm simple.
      if ((item.sentQty ?? 0) > 0) {
        setPendingRemoveIndex(itemIndex);
        setItemPinValue('');
        setItemPinReason('');
        setItemPinError('');
        itemPinModal.open();
        return;
      }

      showAlert(
        'Eliminar producto',
        `¿Seguro que deseas eliminar "${itemName}" de esta orden?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeItemAt(itemIndex);
              } catch {
                showAlert('Error', 'No se pudo eliminar el producto');
              }
            },
          },
        ],
      );
    },
    [order, removeItemAt, itemPinModal],
  );

  const confirmRemoveItemWithPin = useCallback(async () => {
    if (pendingRemoveIndex === null) return;
    const pin = itemPinValue.trim();
    const reason = itemPinReason.trim();
    if (!pin || !reason) {
      setItemPinError('PIN y motivo son obligatorios');
      return;
    }

    setIsAuthorizingItem(true);
    setItemPinError('');
    try {
      await removeItemAt(pendingRemoveIndex, { pin, reason });
      itemPinModal.close();
      setPendingRemoveIndex(null);
      setItemPinValue('');
      setItemPinReason('');
    } catch (err: unknown) {
      // 428 EDIT_PIN_INVALID / EDIT_PIN_REQUIRED → mantener el modal con error.
      if (err instanceof ApiError && err.status === 428) {
        setItemPinError('PIN inválido — intenta de nuevo');
      } else {
        setItemPinError('No se pudo autorizar. Intenta de nuevo.');
      }
    } finally {
      setIsAuthorizingItem(false);
    }
  }, [
    pendingRemoveIndex,
    itemPinValue,
    itemPinReason,
    removeItemAt,
    itemPinModal,
  ]);

  return {
    itemPinModal,
    pendingRemoveIndex,
    setPendingRemoveIndex,
    itemPinValue,
    setItemPinValue,
    itemPinReason,
    setItemPinReason,
    itemPinError,
    setItemPinError,
    isAuthorizingItem,
    handleRemoveItem,
    confirmRemoveItemWithPin,
  };
};
