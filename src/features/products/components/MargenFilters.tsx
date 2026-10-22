'use client';

import React from 'react';
import SelectCustom from '@/components/shared/selectCustom/SelectCustom';
import {
  MargenFilter,
  ProductSort,
} from '@/shared/store/useProductFiltersStore';

interface MargenFiltersProps {
  margenFilter: MargenFilter;
  sort: ProductSort;
  onMargenFilterChangeAction: (filter: MargenFilter) => void;
  onSortChangeAction: (sort: ProductSort) => void;
}

/**
 * Filtrar y ordenar por rentabilidad.
 *
 * El margen sale de `cost`, que ahora mantiene el servidor: cada compra
 * recalcula en cascada el costo de todo lo que lleva ese insumo. Antes el costo
 * de un preparado solo cambiaba al guardar su receta, así que esta lista habría
 * ordenado por un número viejo.
 */
export const MargenFilters = ({
  margenFilter,
  sort,
  onMargenFilterChangeAction,
  onSortChangeAction,
}: MargenFiltersProps) => {
  const margenOptions = [
    { value: 'all', label: 'Toda ganancia' },
    { value: 'perdida', label: 'Pierde plata (≤ 0%)' },
    { value: 'bajo', label: 'Ganancia baja (< 30%)' },
    { value: 'sano', label: 'Ganancia sana (≥ 30%)' },
    // Separado de "pierde plata": no se sabe su margen, no es que sea malo.
    { value: 'sinCosto', label: 'Sin costo cargado' },
  ];

  const sortOptions = [
    { value: 'catalogo', label: 'Orden del catálogo' },
    { value: 'gananciaAsc', label: 'Ganancia: menor a mayor' },
    { value: 'gananciaDesc', label: 'Ganancia: mayor a menor' },
    { value: 'nombre', label: 'Nombre (A-Z)' },
  ];

  return (
    <>
      <SelectCustom
        id="margen-filter"
        options={margenOptions}
        value={margenFilter}
        onChange={(value) => onMargenFilterChangeAction(value as MargenFilter)}
        placeholder="Filtrar por ganancia..."
        className="w-full"
      />
      <SelectCustom
        id="product-sort"
        options={sortOptions}
        value={sort}
        onChange={(value) => onSortChangeAction(value as ProductSort)}
        placeholder="Ordenar por..."
        className="w-full"
      />
    </>
  );
};
