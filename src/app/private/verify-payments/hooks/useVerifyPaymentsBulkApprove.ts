import { useState } from 'react';
import { Order } from '@odin6/types';
import { useToast } from '@/components/hooks/useToast';
import { useDatosDeImpresion } from '@/features/pos/hooks/useDatosDeImpresion';
import {
  approveOrderPayment,
  ApproveOrderPaymentMutations,
} from '@/features/pos/services/approveOrderPayment';

interface UseVerifyPaymentsBulkApproveProps {
  selectedOrders: Order[];
  allUsers: Array<{ id: string; name: string }>;
  bcvRate: number;
  userId: string | undefined;
  mutations: ApproveOrderPaymentMutations;
  onSuccess: () => void;
}

export const useVerifyPaymentsBulkApprove = ({
  selectedOrders,
  allUsers,
  bcvRate,
  userId,
  mutations,
  onSuccess,
}: UseVerifyPaymentsBulkApproveProps) => {
  const [isApproving, setIsApproving] = useState(false);
  const [approveProgress, setApproveProgress] = useState<{
    current: number;
    total: number;
    errors: number;
  } | null>(null);
  const [printInvoices, setPrintInvoices] = useState(false);
  const toast = useToast();
  const datos = useDatosDeImpresion();

  const handleBulkApprove = async () => {
    if (selectedOrders.length === 0) return;

    setIsApproving(true);
    setApproveProgress({
      current: 0,
      total: selectedOrders.length,
      errors: 0,
    });
    let errors = 0;
    let processed = 0;

    for (const order of selectedOrders) {
      processed += 1;
      try {
        const waiterName = allUsers.find((w) => w.id === order.waiterId)?.name;
        await approveOrderPayment({
          order,
          cashierUserId: userId ?? 'unknown-user',
          waiterName,
          bcvRate,
          shouldPrint: printInvoices,
          datos,
          mutations,
        });
      } catch (err) {
        console.error('[VerifyPayments] error aprobando', order.id, err);
        errors += 1;
      }
      setApproveProgress({
        current: processed,
        total: selectedOrders.length,
        errors,
      });
    }

    setIsApproving(false);
    setApproveProgress(null);
    setPrintInvoices(false);

    if (errors === 0) {
      toast.success({
        title: 'Pagos aprobados',
        description: `${processed} ordenes verificadas y cobradas.`,
      });
    } else {
      toast.error({
        title: 'Algunas ordenes fallaron',
        description: `${processed - errors} OK, ${errors} con error. Las que fallaron quedan disponibles para reintentar.`,
      });
    }

    onSuccess();
  };

  return {
    isApproving,
    approveProgress,
    printInvoices,
    setPrintInvoices,
    handleBulkApprove,
  };
};
