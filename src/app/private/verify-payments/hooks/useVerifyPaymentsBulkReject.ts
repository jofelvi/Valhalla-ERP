import { useState } from 'react';
import { Order } from '@odin6/types';
import { PaymentStatusEnum } from '@/shared/types/enumShared';
import { useToast } from '@/components/hooks/useToast';
import { ApproveOrderPaymentMutations } from '@/features/pos/services/approveOrderPayment';

interface UseVerifyPaymentsBulkRejectProps {
  selectedOrders: Order[];
  userId: string | undefined;
  updateOrder: ApproveOrderPaymentMutations['updateOrder'];
  onSuccess: () => void;
}

export const useVerifyPaymentsBulkReject = ({
  selectedOrders,
  userId,
  updateOrder,
  onSuccess,
}: UseVerifyPaymentsBulkRejectProps) => {
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const toast = useToast();

  const handleBulkReject = async () => {
    if (selectedOrders.length === 0) return;
    if (!rejectReason.trim()) {
      toast.error({
        title: 'Motivo requerido',
        description: 'Indica una razon del rechazo.',
      });
      return;
    }

    setIsRejecting(true);
    let errors = 0;

    for (const order of selectedOrders) {
      try {
        await updateOrder.mutateAsync({
          id: order.id,
          data: {
            paymentRejected: true,
            paymentRejectionReason: rejectReason.trim(),
            paymentRejectedAt: new Date(),
            paymentRejectedBy: userId ?? 'unknown-user',
            paymentStatus: PaymentStatusEnum.PENDING,
            pendingPayments: null,
            paymentProofUrls: null,
            paymentReference: null,
            paymentAmountBs: null,
            updatedAt: new Date(),
          },
        });
      } catch (err) {
        console.error('[VerifyPayments] error rechazando', order.id, err);
        errors += 1;
      }
    }

    setIsRejecting(false);
    setRejectReason('');

    if (errors === 0) {
      toast.success({
        title: 'Pagos rechazados',
        description: `${selectedOrders.length} ordenes devueltas al mesonero.`,
      });
    } else {
      toast.error({
        title: 'Algunas fallaron',
        description: `${selectedOrders.length - errors} OK, ${errors} con error.`,
      });
    }

    onSuccess();
  };

  return {
    isRejecting,
    rejectReason,
    setRejectReason,
    handleBulkReject,
  };
};
