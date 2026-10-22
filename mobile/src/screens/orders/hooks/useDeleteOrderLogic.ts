import { useState, useCallback } from 'react';
import { orderService } from '../../../services';
import { showAlert } from '../../../utils/alert';
import { useModal } from '../../../hooks/useModal';

interface DeleteOrderParams {
  orderId: string;
  userUid?: string;
  userDisplayName?: string;
  onSuccess: () => void;
}

export const useDeleteOrderLogic = ({
  orderId,
  userUid,
  userDisplayName,
  onSuccess,
}: DeleteOrderParams) => {
  const deleteModal = useModal('orderDetailDelete');
  const [deletePinValue, setDeletePinValue] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deletePinError, setDeletePinError] = useState('');
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  const handleDeleteOrder = useCallback(async () => {
    const pin = deletePinValue.trim();
    if (!pin) {
      setDeletePinError('Ingresa el PIN de admin');
      return;
    }
    setIsDeletingOrder(true);
    setDeletePinError('');
    try {
      const res = await orderService.cancelOrderWithPin(
        orderId,
        pin,
        deleteReason.trim() || undefined,
        userUid,
        userDisplayName,
      );
      if (!res.success) {
        setDeletePinError('PIN invalido');
        setIsDeletingOrder(false);
        return;
      }
      deleteModal.close();
      setDeletePinValue('');
      setDeleteReason('');
      showAlert(
        'Orden eliminada',
        `Autorizado por ${res.validatedBy ?? 'admin'}`,
        [{ text: 'OK', onPress: onSuccess }],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      if (msg.includes('PIN invalido') || msg.includes('400')) {
        setDeletePinError('PIN invalido');
      } else {
        setDeletePinError('No se pudo eliminar la orden');
      }
      setIsDeletingOrder(false);
    }
  }, [
    deletePinValue,
    deleteReason,
    orderId,
    userUid,
    userDisplayName,
    deleteModal,
    onSuccess,
  ]);

  return {
    deleteModal,
    deletePinValue,
    setDeletePinValue,
    deleteReason,
    setDeleteReason,
    deletePinError,
    setDeletePinError,
    isDeletingOrder,
    handleDeleteOrder,
  };
};
