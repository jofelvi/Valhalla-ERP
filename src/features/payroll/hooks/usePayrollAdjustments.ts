import { useState, useEffect, useRef } from 'react';
import { PayrollAdjustment } from '@odin6/types';

interface PayrollAdjustmentsState {
  adjustments: PayrollAdjustment[];
  setAdjustments?: (adj: PayrollAdjustment[]) => void;
  adjType: 'ADDITION' | 'DEDUCTION';
  setAdjType: (value: 'ADDITION' | 'DEDUCTION') => void;
  adjConcept: string;
  setAdjConcept: (value: string) => void;
  adjAmount: string;
  setAdjAmount: (value: string) => void;
  adjCurrency: 'USD' | 'BS';
  setAdjCurrency: (value: 'USD' | 'BS') => void;
  draftAdjustment: PayrollAdjustment | null;
  draftUsd: number;
  draftMissingConcept: boolean;
  addAdjustment: () => void;
  removeAdjustment: (index: number) => void;
  adjustmentsAdd: number;
  adjustmentsDed: number;
}

export function usePayrollAdjustments(
  bcvRate: number,
): PayrollAdjustmentsState {
  const [adjustments, setAdjustments] = useState<PayrollAdjustment[]>([]);
  const [adjType, setAdjType] = useState<'ADDITION' | 'DEDUCTION'>('DEDUCTION');
  const [adjConcept, setAdjConcept] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjCurrency, setAdjCurrency] = useState<'USD' | 'BS'>('USD');

  const draftAmountNum = parseFloat(adjAmount);
  const hasDraft = Number.isFinite(draftAmountNum) && draftAmountNum > 0;
  const draftUsd = hasDraft
    ? adjCurrency === 'BS' && bcvRate > 0
      ? Math.round((draftAmountNum / bcvRate) * 100) / 100
      : Math.round(draftAmountNum * 100) / 100
    : 0;

  const draftAdjustment: PayrollAdjustment | null = hasDraft
    ? {
        type: adjType,
        concept: adjConcept.trim(),
        amount: draftAmountNum,
        currency: adjCurrency,
        amountUsd: draftUsd,
      }
    : null;

  const draftMissingConcept = hasDraft && !adjConcept.trim();

  const addAdjustment = () => {
    const amount = parseFloat(adjAmount);
    if (!adjConcept.trim() || !Number.isFinite(amount) || amount <= 0) return;
    const amountUsd =
      adjCurrency === 'BS' && bcvRate > 0
        ? Math.round((amount / bcvRate) * 100) / 100
        : Math.round(amount * 100) / 100;
    setAdjustments((prev) => [
      ...prev,
      {
        type: adjType,
        concept: adjConcept.trim(),
        amount,
        currency: adjCurrency,
        amountUsd,
      },
    ]);
    setAdjConcept('');
    setAdjAmount('');
  };

  const removeAdjustment = (index: number) => {
    setAdjustments((prev) => prev.filter((_, i) => i !== index));
  };

  const adjustmentsAdd = adjustments
    .filter((a) => a.type === 'ADDITION')
    .reduce((s, a) => s + a.amountUsd, 0);
  const adjustmentsDed = adjustments
    .filter((a) => a.type === 'DEDUCTION')
    .reduce((s, a) => s + a.amountUsd, 0);

  return {
    adjustments,
    setAdjustments,
    adjType,
    setAdjType,
    adjConcept,
    setAdjConcept,
    adjAmount,
    setAdjAmount,
    adjCurrency,
    setAdjCurrency,
    draftAdjustment,
    draftUsd,
    draftMissingConcept,
    addAdjustment,
    removeAdjustment,
    adjustmentsAdd,
    adjustmentsDed,
  };
}

export function useBonoPizzeroPrecarga(
  bonoPizzero: { total: number; resumen: string } | null | undefined,
  alreadyPaid: boolean,
  adjustments: PayrollAdjustment[],
  setAdjustments: (value: PayrollAdjustment[]) => void,
): void {
  const bonoPrecargadoRef = useRef(false);

  useEffect(() => {
    if (bonoPrecargadoRef.current) return;
    if (alreadyPaid) return;
    if (!bonoPizzero || bonoPizzero.total <= 0) return;

    bonoPrecargadoRef.current = true;
    const yaEsta = adjustments.some((a) => /bono pizza/i.test(a.concept));
    if (yaEsta) return;
    setAdjustments([
      ...adjustments,
      {
        type: 'ADDITION',
        concept: `Bono pizza (${bonoPizzero.resumen})`,
        amount: bonoPizzero.total,
        currency: 'USD',
        amountUsd: bonoPizzero.total,
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonoPizzero, alreadyPaid, setAdjustments]);
}
