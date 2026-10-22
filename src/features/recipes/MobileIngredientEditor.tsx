'use client';

import { useMemo } from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import SearchableSelect from '@/components/shared/searchableSelect/SearchableSelect';
import { Product } from '@odin6/types';
import { ProductPresentationEnum, ProductTypeEnum } from '@/shared';
import { costoDeLinea } from '@/shared/utils/costoDeLinea';
import { formatearUsd } from '@/shared/utils/dinero';
import { esEnvasado, medidasPara } from '@/features/products/naturaleza';
import {
  sonUnidadesCompatibles,
  mensajeUnidadIncompatible,
} from '@/shared/utils/unidades';

export interface IngredienteEditable {
  productId: string;
  quantity: number;
  unit: string;
  wastePercentage: number;
}

interface MobileIngredientEditorProps {
  ingredientes: IngredienteEditable[];
  onChange: (ingredientes: IngredienteEditable[]) => void;
  products: Product[];
}

const ETIQUETAS_UNIDAD: Record<ProductPresentationEnum, string> = {
  [ProductPresentationEnum.UNIT]: 'Unidad',
  [ProductPresentationEnum.BOX]: 'Caja',
  [ProductPresentationEnum.PACK]: 'Paquete',
  [ProductPresentationEnum.BAG]: 'Bolsa',
  [ProductPresentationEnum.BOTTLE]: 'Botella',
  [ProductPresentationEnum.CAN]: 'Lata',
  [ProductPresentationEnum.CONTAINER]: 'Envase',
  [ProductPresentationEnum.JAR]: 'Frasco',
  [ProductPresentationEnum.DOZEN]: 'Docena',
  [ProductPresentationEnum.HALF_DOZEN]: 'Media docena',
  [ProductPresentationEnum.KILOGRAM]: 'Kilos',
  [ProductPresentationEnum.GRAM]: 'Gramos',
  [ProductPresentationEnum.LITER]: 'Litros',
  [ProductPresentationEnum.MILLILITER]: 'Mililitros',
  [ProductPresentationEnum.GALLON]: 'Galón',
  [ProductPresentationEnum.BULK]: 'Bulto',
  [ProductPresentationEnum.ROLL]: 'Rollo',
  [ProductPresentationEnum.PLATE]: 'Plato',
};

/**
 * Editor de ingredientes para el teléfono.
 *
 * El editor del formulario de admin (IngredientsManager) usa una tabla de
 * ~640px: en un móvil obliga a hacer scroll horizontal para escribir la
 * cantidad. Aquí cada ingrediente es una tarjeta apilada con campos grandes.
 * La LÓGICA es la misma de siempre — calculateIngredientCost y
 * areUnitsCompatible, compartidos con el admin; lo único distinto es cómo se
 * ve.
 */
export default function MobileIngredientEditor({
  ingredientes,
  onChange,
  products,
}: MobileIngredientEditorProps) {
  // Cualquier producto activo sirve de ingrediente: la Masa de Pizza es un
  // COMPUESTO y se usa en 24 recetas. Fuera solo los SERVICIOS, que por
  // definición no salen del almacén.
  const disponibles = useMemo(
    () =>
      products.filter(
        (p) => p.isActive !== false && p.type !== ProductTypeEnum.SERVICE,
      ),
    [products],
  );

  const opciones = useMemo(
    () => disponibles.map((p) => ({ value: p.id, label: p.name })),
    [disponibles],
  );

  // La línea con su ESTADO: una unidad que no cruza ya no devuelve 0 en
  // silencio, se marca para que se vea que no suma al costo.
  const lineaDe = (ing: IngredienteEditable) => {
    const insumo = disponibles.find((p) => p.id === ing.productId);
    if (!insumo || !ing.quantity) return null;
    return costoDeLinea(
      insumo,
      ing.quantity,
      ing.unit,
      ing.wastePercentage || 0,
    );
  };
  const costoDe = (ing: IngredienteEditable): number =>
    lineaDe(ing)?.costo ?? 0;

  const actualizar = (i: number, cambios: Partial<IngredienteEditable>) => {
    onChange(
      ingredientes.map((ing, idx) =>
        idx === i ? { ...ing, ...cambios } : ing,
      ),
    );
  };

  const agregar = () => {
    onChange([
      ...ingredientes,
      {
        productId: '',
        quantity: 1,
        unit: ProductPresentationEnum.UNIT,
        wastePercentage: 0,
      },
    ]);
  };

  const quitar = (i: number) => {
    onChange(ingredientes.filter((_, idx) => idx !== i));
  };

  const costoTotal = ingredientes.reduce((s, ing) => s + costoDe(ing), 0);
  const sinCostear = ingredientes.filter((ing) => {
    const l = lineaDe(ing);
    return l !== null && l.estado !== 'ok';
  }).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-content">
          Ingredientes{' '}
          {ingredientes.length > 0 && (
            <span className="text-dim font-normal">
              ({ingredientes.length})
            </span>
          )}
        </h3>
        {costoTotal > 0 && (
          <span className="text-sm font-semibold text-brand">
            Costo: {formatearUsd(costoTotal)}
          </span>
        )}
      </div>

      {sinCostear > 0 && (
        <p className="flex items-start gap-2 text-xs text-danger font-medium mb-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {sinCostear} línea{sinCostear !== 1 ? 's' : ''} sin costear: el costo
          mostrado queda corto.
        </p>
      )}

      {ingredientes.length === 0 && (
        <p className="text-sm text-dim text-center py-6 px-4 rounded-xl border border-dashed border-line">
          Todavía no tiene ingredientes. Agrega lo que lleva para que el sistema
          pueda descontarlo del inventario.
        </p>
      )}

      <div className="space-y-3">
        {ingredientes.map((ing, i) => {
          const insumo = disponibles.find((p) => p.id === ing.productId);
          const compatible =
            !insumo ||
            !ing.unit ||
            sonUnidadesCompatibles(ing.unit, insumo?.presentation, insumo);
          const linea = lineaDe(ing);
          const costo = linea?.costo ?? 0;

          return (
            <div
              key={i}
              className={`rounded-xl border p-3 space-y-3 ${
                !compatible
                  ? 'border-danger bg-danger/10'
                  : 'border-line bg-surface'
              }`}
            >
              {/* Insumo */}
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-semibold text-dim mb-1">
                    ¿Qué lleva?
                  </label>
                  <SearchableSelect
                    id={`ing-${i}-producto`}
                    options={opciones}
                    value={ing.productId}
                    onChange={(v) => {
                      // La medida se ajusta a CÓMO SE COMPRA el insumo: dejar
                      // la anterior permitía guardar "1 und" de algo comprado
                      // por Kilogramo, que se guardaba y nunca descontaba.
                      const nuevo = disponibles.find((x) => x.id === v);
                      actualizar(i, {
                        productId: v,
                        unit: medidasPara(nuevo?.presentation, nuevo)
                          .porDefecto,
                      });
                    }}
                    placeholder="Buscar insumo…"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => quitar(i)}
                  className="mt-6 p-2.5 rounded-lg text-danger hover:bg-danger/10 shrink-0"
                  aria-label="Quitar ingrediente"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Cantidad + unidad, uno al lado del otro (caben en 375px) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-dim mb-1">
                    ¿Cuánto?
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    min="0"
                    value={ing.quantity}
                    onChange={(e) =>
                      actualizar(i, { quantity: Number(e.target.value) })
                    }
                    className="w-full px-3 py-3 rounded-lg bg-page border border-line text-content text-base focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-dim mb-1">
                    Medida
                  </label>
                  <select
                    value={ing.unit}
                    disabled={!insumo}
                    onChange={(e) => actualizar(i, { unit: e.target.value })}
                    className="w-full px-3 py-3 rounded-lg bg-page border border-line text-content text-base disabled:opacity-50 focus:outline-none focus:border-brand"
                  >
                    {/* Solo las medidas que admite su presentación: ofrecer las
                        18 permitía guardar mililitros de algo comprado por
                        Unidad, que se guardaba y NUNCA descontaba. */}
                    {medidasPara(insumo?.presentation, insumo).opciones.map(
                      (u) => (
                        <option key={u} value={u}>
                          {ETIQUETAS_UNIDAD[u as ProductPresentationEnum] ?? u}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              {/* Merma + costo */}
              <div className="grid grid-cols-2 gap-2 items-end">
                <div>
                  <label className="block text-xs font-semibold text-dim mb-1">
                    Se pierde (%)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100"
                    value={ing.wastePercentage}
                    onChange={(e) =>
                      actualizar(i, {
                        wastePercentage: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-3 rounded-lg bg-page border border-line text-content text-base focus:outline-none focus:border-brand"
                  />
                </div>
                <div className="text-right pb-3">
                  <span className="block text-xs text-dim">Costo</span>
                  <span
                    className={`text-base font-semibold ${
                      linea && linea.estado !== 'ok'
                        ? 'text-danger'
                        : 'text-content'
                    }`}
                  >
                    {linea && linea.estado !== 'ok'
                      ? 'sin costear'
                      : formatearUsd(costo)}
                  </span>
                </div>
              </div>

              {esEnvasado(insumo?.presentation) &&
                (ing.wastePercentage ?? 0) > 0 && (
                  <p className="flex items-start gap-2 text-xs text-warn">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    Una lata o botella no se derrama al servirla: esa merma
                    resta stock que no se gastó.
                  </p>
                )}

              {!compatible && insumo && (
                <p className="flex items-start gap-2 text-xs text-danger font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {linea?.mensaje ??
                    mensajeUnidadIncompatible(insumo.name, insumo.presentation)}
                </p>
              )}

              {linea?.estado === 'sin-costo' && (
                <p className="flex items-start gap-2 text-xs text-warn">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {linea.mensaje}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={agregar}
        className="w-full mt-3 flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-dashed border-line text-dim hover:border-brand hover:text-brand transition-colors font-semibold"
      >
        <Plus className="w-5 h-5" /> Agregar ingrediente
      </button>
    </div>
  );
}
