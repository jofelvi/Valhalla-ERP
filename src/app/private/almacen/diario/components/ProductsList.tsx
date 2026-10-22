'use client';
import Link from 'next/link';
import { Package, Search, Minus, Plus } from 'lucide-react';
import { Card } from '@/components/shared/card/card';
import { Input } from '@/components/shared/input/input';
import { PRIVATE_ROUTES } from '@/shared';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';

interface ProductoTabla {
  id: string;
  nombre: string;
  categoria: string;
  stockGeneral: number;
  cantidadSeleccionada: number;
  seleccionado: boolean;
  precio: number;
}

interface ProductsListProps {
  productos: ProductoTabla[];
  onToggleSelection: (productId: string) => void;
  onUpdateQuantity: (productId: string, cantidad: number) => void;
}

export const ProductsList = ({
  productos,
  onToggleSelection,
  onUpdateQuantity,
}: ProductsListProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo<ColumnDef<ProductoTabla>[]>(
    () => [
      {
        id: 'checkbox',
        header: 'Seleccionar',
        cell: ({ row }) => (
          <div
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              row.original.seleccionado
                ? 'bg-brand border-brand'
                : 'border-line bg-surface'
            }`}
          >
            {row.original.seleccionado && (
              <svg
                className="w-4 h-4 text-on-brand"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: productos,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Card>
      <div className="p-4">
        {/* Buscador y acciones */}
        <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dim w-4 h-4" />
            <Input
              type="text"
              placeholder="Buscar productos..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="text-sm text-dim">
            <span className="font-medium text-brand">
              {productos.filter((p) => p.seleccionado).length}
            </span>{' '}
            de {productos.length} seleccionados
          </div>
        </div>

        {/* Lista de productos */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {table.getRowModel().rows.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="w-12 h-12 text-dim mx-auto mb-3" />
              <p className="text-dim font-medium">
                No hay productos con stock disponible
              </p>
              <p className="text-dim text-sm mt-1">
                Agrega stock a los productos desde el{' '}
                <Link
                  href={PRIVATE_ROUTES.ALMACEN_GENERAL}
                  className="text-brand hover:underline"
                >
                  Almacén General
                </Link>{' '}
                o verifica que los productos tengan stock asignado.
              </p>
            </div>
          ) : (
            productos.map((row) => (
              <div
                key={row.id}
                className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                  row.seleccionado
                    ? 'border-brand bg-elevated'
                    : 'border-line bg-surface hover:border-line hover:bg-elevated'
                }`}
                onClick={() => onToggleSelection(row.id)}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox grande */}
                  <div
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      row.seleccionado
                        ? 'bg-brand border-brand'
                        : 'border-line bg-surface'
                    }`}
                  >
                    {row.seleccionado && (
                      <svg
                        className="w-4 h-4 text-on-brand"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Info del producto */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-content truncate">
                      {row.nombre}
                    </p>
                    <p className="text-xs text-dim">
                      Stock disponible:{' '}
                      <span className="font-medium text-dim">
                        {row.stockGeneral}
                      </span>{' '}
                      • ${row.precio.toFixed(2)}
                    </p>
                  </div>

                  {/* Control de cantidad */}
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() =>
                        onUpdateQuantity(row.id, row.cantidadSeleccionada - 1)
                      }
                      disabled={row.cantidadSeleccionada === 0}
                      className="w-8 h-8 rounded-lg bg-elevated hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      value={row.cantidadSeleccionada}
                      onChange={(e) =>
                        onUpdateQuantity(row.id, parseInt(e.target.value) || 0)
                      }
                      className="w-14 text-center border border-line rounded-lg py-1.5 text-sm font-medium focus:ring-2 focus:ring-brand focus:border-transparent"
                      min={0}
                      max={row.stockGeneral}
                    />
                    <button
                      onClick={() =>
                        onUpdateQuantity(row.id, row.cantidadSeleccionada + 1)
                      }
                      disabled={row.cantidadSeleccionada >= row.stockGeneral}
                      className="w-8 h-8 rounded-lg bg-elevated hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onUpdateQuantity(row.id, row.stockGeneral)}
                      className="ml-1 px-2 py-1 text-xs text-brand hover:text-content font-medium bg-elevated rounded hover:bg-elevated transition-colors"
                    >
                      Max
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info de la lista */}
        <div className="mt-3 pt-3 border-t border-line text-sm text-dim">
          Mostrando {table.getRowModel().rows.length} de {productos.length}{' '}
          productos
        </div>
      </div>
    </Card>
  );
};
