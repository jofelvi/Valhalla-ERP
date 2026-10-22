import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Budget } from '@odin6/types';
import { BudgetStatusEnum } from '@/shared/types/enumShared';
import { useBudget, useUpdateBudget } from '@/hooks/useBudgets';
import { useToast } from '@/components/hooks/useToast';
import { useContextoPdf } from '@/shared/hooks/useContextoPdf';
import {
  downloadBudgetPDF,
  downloadAcuseRecibo,
} from '@/shared/utils/pdfGenerator';
import { STATUS_CONFIG_BASE } from '../utils';

interface UseBudgetDetailReturn {
  budget: Budget | undefined;
  isLoading: boolean;
  isUpdating: boolean;
  showStatusMenu: boolean;
  showGenerateInvoice: boolean;
  setShowStatusMenu: (open: boolean) => void;
  setShowGenerateInvoice: (open: boolean) => void;
  handleStatusChange: (newStatus: BudgetStatusEnum) => Promise<void>;
  handleDownloadPDF: () => void;
  handleDownloadAcuse: () => void;
}

export function useBudgetDetail(budgetId: string): UseBudgetDetailReturn {
  const toast = useToast();
  const { data: budget, isLoading } = useBudget(budgetId);
  const updateBudget = useUpdateBudget();

  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showGenerateInvoice, setShowGenerateInvoice] = useState(false);

  const handleStatusChange = useCallback(
    async (newStatus: BudgetStatusEnum) => {
      if (!budget) return;

      setShowStatusMenu(false);

      try {
        await updateBudget.mutateAsync({
          id: budget.id,
          data: {
            status: newStatus,
            updatedAt: new Date(),
          },
        });
        const statusLabel = STATUS_CONFIG_BASE[newStatus].label;
        toast.success({ description: `Estado cambiado a "${statusLabel}"` });
      } catch {
        toast.error({
          description: 'Error al cambiar el estado del presupuesto',
        });
      }
    },
    [budget, updateBudget, toast],
  );

  const contexto = useContextoPdf();
  const { data: session } = useSession();

  const handleDownloadPDF = useCallback(() => {
    if (!budget) return;
    try {
      downloadBudgetPDF(budget, contexto);
      toast.success({ description: 'PDF descargado correctamente' });
    } catch {
      toast.error({ description: 'Error al generar el PDF' });
    }
  }, [budget, toast, contexto]);

  const handleDownloadAcuse = useCallback(() => {
    if (!budget) return;
    try {
      downloadAcuseRecibo({
        budget,
        representativeName: session?.user?.name ?? '',
        representativeCI: '',
        contexto,
      });
      toast.success({ description: 'Acuse de recibo descargado' });
    } catch {
      toast.error({ description: 'Error al generar el acuse de recibo' });
    }
  }, [budget, toast, contexto, session]);

  return {
    budget,
    isLoading,
    isUpdating: updateBudget.isPending,
    showStatusMenu,
    showGenerateInvoice,
    setShowStatusMenu,
    setShowGenerateInvoice,
    handleStatusChange,
    handleDownloadPDF,
    handleDownloadAcuse,
  };
}
