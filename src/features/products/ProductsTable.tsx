'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from '@/shared/ui/AppLink/AppLink';
import { FiPackage, FiTrash2 } from 'react-icons/fi';
import { Eye, Pencil, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/shared/badge/badge';
import { Button } from '@/components/shared/button/Button';
import { PRIVATE_ROUTES } from '@/shared';
import { Product } from '@odin6/types';
import { Category } from '@odin6/types';
import {
  COLOR_MARGEN,
  NATURALEZA,
  margenPct,
  naturalezaDeProducto,
  nivelDeMargen,
} from './naturaleza';

interface ProductsTableProps {
  products: Product[];
  categories: Category[];
  /** Stock REAL por almacén; `product.stock` lleva congelado desde la migración. */
  stockPorProducto?: Map<string, { qty: number; almacen: string }>;
  /**
   * Cuántas unidades salen de cada PREPARADO con el stock de hoy.
   *
   * Un preparado no tiene fila de stock propia (la pizza no está en la nevera:
   * están la masa y el queso), así que la columna le ponía "sin registro" a
   * las 41 pizzas y a los 52 platos con receta. Aquí va lo que sí sirve.
   */
  porcionesPorProducto?: Map<string, { estado: string; maxPorciones?: number }>;
  onDelete: (product: Product) => void;
  onProductUpdate: (id: string, updates: Partial<Product>) => Promise<void>;
}

/** Semáforo sobre el stock del ALMACÉN, que es el que ve el mesonero. */
function getStockIndicator(
  product: Product,
  real: number | undefined,
): { label: string; variant: 'destructive' | 'warning' | 'success' } | null {
  if (real === undefined) return null;
  if (real <= 0) return { label: 'Sin stock', variant: 'destructive' };
  const minStock = product.minStock ?? 5;
  if (real <= minStock) return { label: 'Bajo', variant: 'warning' };
  return { label: 'OK', variant: 'success' };
}

/** Lo que se pinta en la columna de un preparado. */
function porcionesLegibles(d?: {
  estado: string;
  maxPorciones?: number;
}): { texto: string; ayuda: string; alerta: boolean } | null {
  if (!d) return null;
  if (d.estado === 'SIN_LINEA_BASE') {
    return {
      texto: 'sin conteo',
      ayuda:
        'Falta el conteo inicial de algún ingrediente: no se puede saber cuántas salen',
      alerta: false,
    };
  }
  if (d.estado === 'SIN_CONTROL') {
    return {
      texto: 'sin receta',
      ayuda: 'No descuenta nada al venderse: cárgale la receta desde Recetas',
      alerta: true,
    };
  }
  if (typeof d.maxPorciones !== 'number') return null;
  return {
    texto: `${d.maxPorciones} salen`,
    ayuda: 'Cuántas unidades alcanzan con el stock de hoy, según su receta',
    alerta: d.maxPorciones === 0,
  };
}

export function ProductsTable({
  products,
  categories,
  stockPorProducto,
  porcionesPorProducto,
  onDelete,
  onProductUpdate,
}: ProductsTableProps) {
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const handleToggle = async (
    product: Product,
    field: 'isActive' | 'isForSale',
    value: boolean,
  ) => {
    setUpdatingKey(`${product.id}:${field}`);
    try {
      await onProductUpdate(product.id, { [field]: value });
    } finally {
      setUpdatingKey(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-dim uppercase bg-elevated border-b border-line">
          <tr>
            <th className="px-3 py-3">Imagen</th>
            <th className="px-3 py-3">Nombre</th>
            <th className="px-3 py-3">Categoría</th>
            <th className="px-3 py-3">Precio</th>
            <th className="px-3 py-3 text-right">Ganancia</th>
            <th className="px-3 py-3">Stock real</th>
            <th className="px-3 py-3">Naturaleza</th>
            <th className="px-3 py-3">Activo</th>
            <th className="px-3 py-3">En Venta</th>
            <th className="px-3 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {products.map((product) => {
            const real = stockPorProducto?.get(product.id);
            const stockInfo = getStockIndicator(product, real?.qty);
            const porciones = porcionesLegibles(
              porcionesPorProducto?.get(product.id),
            );
            const naturaleza = naturalezaDeProducto(product);
            const margen = margenPct(product);
            const nivelMargen = nivelDeMargen(product);
            const categoryName = categoryMap.get(product.categoryId) ?? '—';
            const isUpdatingActive = updatingKey === `${product.id}:isActive`;
            const isUpdatingForSale = updatingKey === `${product.id}:isForSale`;
            return (
              <tr
                key={product.id}
                className="hover:bg-elevated transition-colors"
              >
                {/* Imagen */}
                <td className="px-3 py-2">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-elevated flex items-center justify-center flex-shrink-0">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        width={40}
                        height={40}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <FiPackage className="w-5 h-5 text-dim" />
                    )}
                  </div>
                </td>

                {/* Nombre + descripcion */}
                <td className="px-3 py-2 max-w-[200px]">
                  <div className="font-medium text-content truncate">
                    {product.name}
                  </div>
                  {product.description && (
                    <div className="text-xs text-dim truncate">
                      {product.description}
                    </div>
                  )}
                </td>

                {/* Categoria */}
                <td className="px-3 py-2">
                  <Badge variant="secondary" className="whitespace-nowrap">
                    {categoryName}
                  </Badge>
                </td>

                {/* Precio + margen */}
                <td className="px-3 py-2">
                  <div className="font-medium text-content">
                    ${product.price.toFixed(2)}
                  </div>
                  {product.cost ? (
                    <div className="text-xs text-dim mt-0.5">
                      cuesta ${product.cost.toFixed(2)}
                    </div>
                  ) : null}
                </td>

                {/* Ganancia — el costo lo mantiene el servidor con cada compra */}
                <td className="px-3 py-2 text-right">
                  {margen === null ? (
                    <span
                      className="text-xs text-dim"
                      title="Sin costo cargado: no se puede saber el margen"
                    >
                      sin costo
                    </span>
                  ) : (
                    <span
                      className={`font-semibold ${COLOR_MARGEN[nivelMargen]}`}
                    >
                      {margen.toFixed(0)}%
                    </span>
                  )}
                </td>

                {/* Stock REAL del almacén: el número que ve el mesonero */}
                <td className="px-3 py-2">
                  {naturaleza === 'servicio' ? (
                    <span className="text-xs text-dim">no lleva</span>
                  ) : real === undefined ? (
                    porciones ? (
                      <span
                        className={`text-xs font-medium ${porciones.alerta ? 'text-danger' : 'text-dim'}`}
                        title={porciones.ayuda}
                      >
                        {porciones.texto}
                      </span>
                    ) : (
                      <span
                        className="text-xs text-dim"
                        title="Sin fila de stock en su almacén"
                      >
                        sin registro
                      </span>
                    )
                  ) : (
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium ${real.qty <= 0 ? 'text-danger' : 'text-content'}`}
                      >
                        {Math.round(real.qty * 100) / 100}
                      </span>
                      {stockInfo && (
                        <Badge
                          variant={stockInfo.variant}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {stockInfo.label}
                        </Badge>
                      )}
                      <span className="text-[10px] text-dim">
                        {real.almacen}
                      </span>
                    </div>
                  )}
                </td>

                {/* Naturaleza — "Base"/"Compuesto" no le decía nada a nadie */}
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-md border text-xs font-semibold whitespace-nowrap ${NATURALEZA[naturaleza].color}`}
                    title={NATURALEZA[naturaleza].queDescuenta}
                  >
                    {NATURALEZA[naturaleza].titulo}
                  </span>
                </td>

                {/* Activo */}
                <td className="px-3 py-2">
                  {isUpdatingActive ? (
                    <Loader2 className="w-4 h-4 animate-spin text-dim" />
                  ) : (
                    <Switch
                      checked={product.isActive}
                      onCheckedChange={(checked) =>
                        handleToggle(product, 'isActive', checked)
                      }
                    />
                  )}
                </td>

                {/* En Venta */}
                <td className="px-3 py-2">
                  {isUpdatingForSale ? (
                    <Loader2 className="w-4 h-4 animate-spin text-dim" />
                  ) : (
                    <Switch
                      checked={product.isForSale}
                      onCheckedChange={(checked) =>
                        handleToggle(product, 'isForSale', checked)
                      }
                    />
                  )}
                </td>

                {/* Acciones */}
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={PRIVATE_ROUTES.PRODUCTS_DETAILS(product.id)}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1.5 h-auto text-dim hover:text-brand"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link href={PRIVATE_ROUTES.PRODUCTS_EDIT(product.id)}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1.5 h-auto text-dim hover:text-brand"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1.5 h-auto text-dim hover:text-danger"
                      title="Eliminar"
                      onClick={() => onDelete(product)}
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
