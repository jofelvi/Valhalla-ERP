import { useState } from 'react';
import { Order } from '@/modelTypes/order';
import { User } from '@/modelTypes/user';
import { PaymentStatusEnum } from '@/shared';
import { useUpdateOrder, useCancelOrderWithPin } from '@/hooks/useOrders';
import { tokenDeSesion } from '@/services/api/apiClient';
import { fusionarOrden } from '@/features/pos/services/mergeOrders';

interface AliasModalState {
  aliasOrder: Order | null;
  aliasValue: string;
  isSavingAlias: boolean;
}

interface RejectModalState {
  orderToReject: Order | null;
  rejectionReason: string;
  isRejecting: boolean;
}

interface ResetModalState {
  resetTarget: { order: Order; label: string } | null;
  resetPin: string;
  resetReason: string;
  resetError: string;
  isResetting: boolean;
}

interface MergeModalState {
  pendingMerge: {
    destOrderId: string;
    sourceOrderId: string;
    etiqueta: string;
  } | null;
  mergePin: string;
  mergeError: string | null;
  isTransferring: boolean;
}

interface ModalFormsActions {
  // Alias
  openAliasModal: (order: Order) => void;
  closeAliasModal: () => void;
  setAliasValue: (value: string) => void;
  saveAlias: () => Promise<void>;

  // Reject
  openRejectModal: (order: Order) => void;
  closeRejectModal: () => void;
  setRejectionReason: (reason: string) => void;
  handleRejectPayment: () => Promise<void>;

  // Reset
  openResetTable: (order: Order, label: string) => void;
  openResetZoneOrder: (order: Order, label: string) => void;
  closeResetModal: () => void;
  setResetPin: (pin: string) => void;
  setResetReason: (reason: string) => void;
  handleResetOrder: () => Promise<void>;

  // Merge
  pedirPinParaFusionar: (
    destOrderId: string,
    etiqueta: string,
    sourceOrderId: string,
  ) => void;
  closeMergeModal: () => void;
  setMergePin: (pin: string) => void;
  confirmarFusion: () => Promise<void>;
}

export const useModalForms = (
  onRefetch: () => void,
  currentUser?: User,
): AliasModalState &
  RejectModalState &
  ResetModalState &
  MergeModalState &
  ModalFormsActions => {
  // Alias
  const [aliasOrder, setAliasOrder] = useState<Order | null>(null);
  const [aliasValue, setAliasValueInternal] = useState('');
  const [isSavingAlias, setIsSavingAlias] = useState(false);

  // Reject
  const [orderToReject, setOrderToReject] = useState<Order | null>(null);
  const [rejectionReason, setRejectionReasonInternal] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Reset
  const [resetTarget, setResetTarget] = useState<{
    order: Order;
    label: string;
  } | null>(null);
  const [resetPin, setResetPinInternal] = useState('');
  const [resetReason, setResetReasonInternal] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Merge
  const [pendingMerge, setPendingMerge] = useState<{
    destOrderId: string;
    sourceOrderId: string;
    etiqueta: string;
  } | null>(null);
  const [mergePin, setMergePinInternal] = useState('');
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const updateOrder = useUpdateOrder();
  const cancelOrderWithPin = useCancelOrderWithPin();

  // ─── Alias ───
  const openAliasModal = (order: Order) => {
    setAliasOrder(order);
    setAliasValueInternal(order.customerAlias || '');
  };

  const closeAliasModal = () => {
    setAliasOrder(null);
    setAliasValueInternal('');
  };

  const saveAlias = async () => {
    if (!aliasOrder) return;
    setIsSavingAlias(true);
    try {
      await updateOrder.mutateAsync({
        id: aliasOrder.id,
        data: {
          customerAlias: aliasValue.trim() || null,
          updatedAt: new Date(),
        },
      });
      closeAliasModal();
      onRefetch();
    } catch (err) {
      console.error('Error guardando alias:', err);
    } finally {
      setIsSavingAlias(false);
    }
  };

  // ─── Reject ───
  const openRejectModal = (order: Order) => {
    setOrderToReject(order);
    setRejectionReasonInternal('');
  };

  const closeRejectModal = () => {
    setOrderToReject(null);
    setRejectionReasonInternal('');
  };

  const handleRejectPayment = async () => {
    if (!orderToReject) return;
    if (!rejectionReason.trim()) {
      alert(
        'Ingresa un motivo del rechazo para que el mesonero sepa que corregir',
      );
      return;
    }
    setIsRejecting(true);
    try {
      await updateOrder.mutateAsync({
        id: orderToReject.id,
        data: {
          paymentRejected: true,
          paymentRejectionReason: rejectionReason.trim(),
          paymentRejectedAt: new Date(),
          paymentStatus: PaymentStatusEnum.PENDING,
          pendingPayments: null,
          paymentProofUrls: null,
          paymentReference: null,
          paymentAmountBs: null,
          updatedAt: new Date(),
        },
      });
      closeRejectModal();
      onRefetch();
    } catch (err) {
      console.error('Error al rechazar pago:', err);
      alert('No se pudo rechazar el pago');
    } finally {
      setIsRejecting(false);
    }
  };

  // ─── Reset ───
  const openResetTable = (order: Order, label: string) => {
    setResetTarget({ order, label });
    setResetPinInternal('');
    setResetReasonInternal('');
    setResetError('');
  };

  const openResetZoneOrder = (order: Order, label: string) => {
    setResetTarget({ order, label });
    setResetPinInternal('');
    setResetReasonInternal('');
    setResetError('');
  };

  const closeResetModal = () => {
    setResetTarget(null);
    setResetPinInternal('');
    setResetReasonInternal('');
    setResetError('');
  };

  const handleResetOrder = async () => {
    if (!resetTarget?.order) return;
    if (!resetPin.trim() || resetPin.trim().length < 4) {
      setResetError('Ingresa un PIN valido (minimo 4 digitos)');
      return;
    }
    setResetError('');
    setIsResetting(true);
    try {
      await cancelOrderWithPin.mutateAsync({
        orderId: resetTarget.order.id,
        pin: resetPin.trim(),
        reason: resetReason.trim() || `Reset ${resetTarget.label} desde POS`,
        userId: currentUser?.id,
        userName: currentUser?.name,
      });
      closeResetModal();
      onRefetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      if (
        msg.includes('401') ||
        msg.includes('403') ||
        msg.toLowerCase().includes('pin')
      ) {
        setResetError('PIN incorrecto');
      } else {
        setResetError(msg.slice(0, 150));
      }
    } finally {
      setIsResetting(false);
    }
  };

  // ─── Merge ───
  const pedirPinParaFusionar = (
    destOrderId: string,
    etiqueta: string,
    sourceOrderId: string,
  ) => {
    setPendingMerge({ destOrderId, etiqueta, sourceOrderId });
    setMergePinInternal('');
    setMergeError(null);
  };

  const closeMergeModal = () => {
    setPendingMerge(null);
    setMergePinInternal('');
    setMergeError(null);
  };

  const confirmarFusion = async () => {
    if (!pendingMerge || !mergePin.trim() || isTransferring) return;
    setIsTransferring(true);
    setMergeError(null);
    try {
      const token = await tokenDeSesion();
      await fusionarOrden(
        pendingMerge.destOrderId,
        pendingMerge.sourceOrderId,
        mergePin.trim(),
        token,
      );
      closeMergeModal();
      onRefetch();
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'No se pudo fusionar');
      setMergePinInternal('');
    } finally {
      setIsTransferring(false);
    }
  };

  return {
    // Alias
    aliasOrder,
    aliasValue,
    isSavingAlias,
    openAliasModal,
    closeAliasModal,
    setAliasValue: setAliasValueInternal,
    saveAlias,

    // Reject
    orderToReject,
    rejectionReason,
    isRejecting,
    openRejectModal,
    closeRejectModal,
    setRejectionReason: setRejectionReasonInternal,
    handleRejectPayment,

    // Reset
    resetTarget,
    resetPin,
    resetReason,
    resetError,
    isResetting,
    openResetTable,
    openResetZoneOrder,
    closeResetModal,
    setResetPin: setResetPinInternal,
    setResetReason: setResetReasonInternal,
    handleResetOrder,

    // Merge
    pendingMerge,
    mergePin,
    mergeError,
    isTransferring,
    pedirPinParaFusionar,
    closeMergeModal,
    setMergePin: setMergePinInternal,
    confirmarFusion,
  };
};
