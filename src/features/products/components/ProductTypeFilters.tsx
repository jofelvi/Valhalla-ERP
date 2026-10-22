'use client';

import React from 'react';
import SelectCustom from '@/components/shared/selectCustom/SelectCustom';
import { ProductTypeFilter } from '@/shared/store/useProductFiltersStore';

interface ProductTypeFiltersProps {
  productTypeFilter: ProductTypeFilter;
  onProductTypeFilterChangeAction: (filter: ProductTypeFilter) => void;
}

export const ProductTypeFilters = ({
  productTypeFilter,
  onProductTypeFilterChangeAction,
}: ProductTypeFiltersProps) => {
  // Las etiquetas dicen QUÉ ES el producto, no cómo se llama el campo:
  // "Base" y "Compuesto" no le decían nada a nadie fuera del código.
  const typeFilterOptions = [
    { value: 'all', label: 'Todas las naturalezas' },
    { value: 'BASE', label: 'Insumos' },
    { value: 'COMPUESTO', label: 'Preparados' },
    { value: 'SERVICIO', label: 'Servicios' },
  ];

  return (
    <SelectCustom
      id="product-type-filter"
      options={typeFilterOptions}
      value={productTypeFilter}
      onChange={(value) =>
        onProductTypeFilterChangeAction(value as ProductTypeFilter)
      }
      placeholder="Filtrar por tipo..."
      className="w-full"
    />
  );
};
