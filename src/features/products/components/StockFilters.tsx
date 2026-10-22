'use client';

import React from 'react';
import SelectCustom from '@/components/shared/selectCustom/SelectCustom';

interface StockFiltersProps {
  stockFilter: 'all' | 'outOfStock' | 'lowStock';
  onStockFilterChangeAction: (
    filter: 'all' | 'outOfStock' | 'lowStock',
  ) => void;
}

export const StockFilters = ({
  stockFilter,
  onStockFilterChangeAction,
}: StockFiltersProps) => {
  const stockFilterOptions = [
    { value: 'all', label: 'Todos los productos' },
    { value: 'outOfStock', label: 'Sin stock' },
    { value: 'lowStock', label: 'Bajo stock' },
  ];

  return (
    <SelectCustom
      id="stock-filter"
      options={stockFilterOptions}
      value={stockFilter}
      onChange={(value) =>
        onStockFilterChangeAction(value as 'all' | 'outOfStock' | 'lowStock')
      }
      placeholder="Filtrar por stock..."
      className="w-full"
    />
  );
};
