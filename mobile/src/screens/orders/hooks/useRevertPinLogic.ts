import { useState, useCallback } from 'react';
import { Order } from '../../../types';
import { adminPinService } from '../../../services';
import { showAlert } from '../../../utils/alert';
import { useModal } from '../../../hooks/useModal';

interface RevertTarget {
  productId: string;
  itemIndex: number;
  deliveredQty: number;
}

interface UseRevertPinLogicParams {
  order: Order | null;
  onDeliveryChange: (itemIndex: number, newQty: number) => void;
}

export const useRevertPinLogic = ({
  order,
  onDeliveryChange,
}: UseRevertPinLogicParams) => {
  const revertPinModal = useModal('orderDetailRevertPin');
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [isValidatingPin, setIsValidatingPin] = useState(false);
  const [revertTarget, setRevertTarget] = useState<RevertTarget | null>(null);

  const handleRevertRequest = useCallback(
    (itemIndex: number) => {
      if (!order) return;
      const item = order.items[itemIndex];
      setRevertTarget({
        productId: item.productId,
        itemIndex,
        deliveredQty: item.deliveredQty ?? 0,
      });
      setPinValue('');
      setPinError('');
      revertPinModal.open();
    },
    [order, revertPinModal],
  );

  const handlePinSubmit = useCallback(async () => {
    if (!pinValue.trim()) {
      setPinError('Ingresa el PIN de autorizacion');
      return;
    }

    setIsValidatingPin(true);
    setPinError('');

    try {
      const result = await adminPinService.validatePin(pinValue.trim());

      if (!result.valid) {
        setPinError('PIN incorrecto o no autorizado');
        setIsValidatingPin(false);
        return;
      }

      // Buscar el item actual por productId (puede haber cambiado de indice)
      if (revertTarget && order) {
        const currentIndex = order.items.findIndex(
          (item, i) =>
            item.productId === revertTarget.productId &&
            (i === revertTarget.itemIndex || (item.deliveredQty ?? 0) > 0),
        );

        if (currentIndex === -1) {
          setPinError('El item ya no existe en el pedido');
          setIsValidatingPin(false);
          return;
        }

        const currentDelivered = order.items[currentIndex].deliveredQty ?? 0;
        if (currentDelivered <= 0) {
          setPinError('El item ya no tiene entregas para revertir');
          setIsValidatingPin(false);
          return;
        }

        onDeliveryChange(currentIndex, currentDelivered - 1);
      }

      revertPinModal.close();
      showAlert('Entrega revertida', `Autorizado por ${result.adminName}`);
    } catch {
      setPinError('Error validando PIN. Intenta de nuevo.');
    } finally {
      setIsValidatingPin(false);
    }
  }, [pinValue, revertTarget, order, onDeliveryChange, revertPinModal]);

  return {
    revertPinModal,
    pinValue,
    setPinValue,
    pinError,
    setPinError,
    isValidatingPin,
    revertTarget,
    handleRevertRequest,
    handlePinSubmit,
  };
};
