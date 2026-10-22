import { useEffect, useState, useMemo } from 'react';
import { PriceVarianceReport } from '@/features/supply-chain/types/merchandiseReceiptTypes';
import { merchandiseReceiptService } from '@/features/supply-chain/services/merchandiseReceiptService';
import { ReceiptFormData } from '../types';
import { buildReceivedItemsFromForm } from '../utils/priceVarianceCalculations';

interface UseReceiptVariancesReturn {
  priceVariances: PriceVarianceReport[];
  showVariances: boolean;
}

/**
 * Hook que calcula varianzas de precios en tiempo real mientras se editan los items
 * Ejecuta calculateVariances cada vez que cambien los items observados
 */
export const useReceiptVariances = (
  watchedItems: ReceiptFormData['items'] | undefined,
): UseReceiptVariancesReturn => {
  const [priceVariances, setPriceVariances] = useState<PriceVarianceReport[]>(
    [],
  );

  useEffect(() => {
    if (!watchedItems || watchedItems.length === 0) {
      setPriceVariances([]);
      return;
    }

    const receivedItems = buildReceivedItemsFromForm(watchedItems);
    const variances =
      merchandiseReceiptService.calculatePriceVariances(receivedItems);
    setPriceVariances(variances);
  }, [watchedItems]);

  // Mostrar varianzas solo si hay alguna con diferencia significativa
  const showVariances = useMemo(
    () => priceVariances.some((v) => Math.abs(v.variance) > 0.01),
    [priceVariances],
  );

  return {
    priceVariances,
    showVariances,
  };
};
