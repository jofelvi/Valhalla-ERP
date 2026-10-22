'use client';
import Modal from '@/components/shared/modal';

import { useState, useMemo } from 'react';
import { X, Save, Loader2, Zap } from 'lucide-react';
import { Product } from '@odin6/types';
import { Button } from '@/components/shared/button/Button';
import { ProductPresentationEnum } from '@/shared';
import {
  useUpdateProductRecipe,
  type RecipeIngredientInput,
} from '@/hooks/useProducts';
import { useToast } from '@/shared/hooks/useToast';
import MobileIngredientEditor, {
  type IngredienteEditable,
} from './MobileIngredientEditor';
import { naturalezaDeProducto } from '@/features/products/naturaleza';
import {
  sonUnidadesCompatibles,
  mensajeUnidadIncompatible,
} from '@/shared/utils/unidades';

interface RecipeEditorModalProps {
  product: Product;
  products: Product[];
  onClose: () => void;
}

/**
 * Editor de receta para el personal de estación, pensado para el teléfono:
 * hoja que sube desde abajo, campos grandes y una tarjeta por ingrediente.
 */
export default function RecipeEditorModal({
  product,
  products,
  onClose,
}: RecipeEditorModalProps) {
  const toast = useToast();
  const guardarReceta = useUpdateProductRecipe();

  const [ingredientes, setIngredientes] = useState<IngredienteEditable[]>(
    (product.ingredients ?? []).map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unit: i.unit || ProductPresentationEnum.UNIT,
      wastePercentage: i.wastePercentage ?? 0,
    })),
  );
  const [ventaDirecta, setVentaDirecta] = useState<boolean>(
    product.isForInventory === true,
  );

  // "Se descuenta directo" solo tiene sentido en algo que se COMPRA HECHO: una
  // lata, una botella, una chuchería. Ofrecérselo a un plato de cocina fue lo
  // que dejó a los tobos descontando un stock fantasma de sí mismos en vez de
  // las cervezas. Un producto que ya tiene receta tampoco lo necesita.
  const naturaleza = naturalezaDeProducto(product);
  const puedeSerDirecto =
    naturaleza !== 'preparado' &&
    String(product.station ?? '').toUpperCase() !== 'KITCHEN' &&
    String(product.station ?? '').toUpperCase() !== 'PIZZA';

  /**
   * Detecta ingredientes con unidades incompatibles con cómo se compran.
   * Se usa para mostrar error antes de guardar.
   */
  const incompatiblesDetectados = useMemo(() => {
    if (!ingredientes || ingredientes.length === 0) return [];
    return ingredientes
      .map((ing) => {
        if (!ing.productId || !ing.unit) return null;
        const insumo = products.find((p) => p.id === ing.productId);
        if (!insumo) return null;
        if (!sonUnidadesCompatibles(ing.unit, insumo.presentation, insumo)) {
          return {
            insumoId: ing.productId,
            insumoNombre: insumo.name,
            unidadUsada: ing.unit,
            unidadCompra: insumo.presentation,
          };
        }
        return null;
      })
      .filter((x) => x !== null);
  }, [ingredientes, products]);

  const guardar = async (): Promise<void> => {
    // Validar que no haya unidades incompatibles
    if (incompatiblesDetectados.length > 0) {
      const lista = incompatiblesDetectados
        .map((x) => mensajeUnidadIncompatible(x.insumoNombre, x.unidadCompra))
        .join('\n');
      toast.error({
        title: 'Unidades incompatibles',
        description: `Corrige estas medidas:\n${lista}`,
      });
      return;
    }

    const limpios: RecipeIngredientInput[] = ingredientes
      .filter((i) => i.productId && i.quantity > 0)
      .map((i) => ({
        productId: i.productId,
        quantity: Number(i.quantity),
        unit: String(i.unit),
        wastePercentage: Number(i.wastePercentage ?? 0),
      }));

    if (limpios.length === 0 && !ventaDirecta) {
      toast.error({
        title: 'Falta la receta',
        description: puedeSerDirecto
          ? 'Agrega al menos un ingrediente, o marca "se descuenta directo" si es una botella o lata.'
          : 'Agrega al menos un ingrediente: sin receta, lo que se venda no baja del inventario.',
      });
      return;
    }

    try {
      await guardarReceta.mutateAsync({
        id: product.id,
        ingredients: limpios,
        isForInventory: ventaDirecta,
      });
      toast.success({
        title: 'Receta guardada',
        description: `${product.name} ya descuenta del inventario`,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Intenta de nuevo';
      toast.error({ title: 'No se pudo guardar', description: msg });
    }
  };

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      hojaEnMovil
      classNameFondo="bg-black/60"
      className="bg-page w-full sm:max-w-2xl h-[92vh] sm:h-auto sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-line bg-surface shrink-0">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-content truncate">
            {product.name}
          </h2>
          <p className="text-xs text-dim">¿Qué lleva y cuánto?</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-lg hover:bg-elevated text-dim shrink-0"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Cuerpo */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Venta directa: botellas y latas que no se preparan */}
        {puedeSerDirecto && (
          <button
            type="button"
            onClick={() => setVentaDirecta((v) => !v)}
            className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 mb-4 text-left transition-colors ${
              ventaDirecta
                ? 'border-brand bg-brand/10'
                : 'border-line bg-surface'
            }`}
          >
            <Zap
              className={`w-5 h-5 mt-0.5 shrink-0 ${ventaDirecta ? 'text-brand' : 'text-dim'}`}
            />
            <span>
              <span className="block text-sm font-semibold text-content">
                Se descuenta directo
              </span>
              <span className="block text-xs text-dim mt-0.5">
                Para botellas y latas que se venden tal cual, sin preparar. No
                necesitan receta: cada venta descuenta una unidad.
              </span>
            </span>
          </button>
        )}

        {!puedeSerDirecto && naturaleza === 'pendiente' && (
          <p className="text-xs text-dim mb-4 p-3 rounded-xl border border-line bg-surface">
            Lo que sale de cocina o pizza siempre lleva receta: aquí se carga
            qué usa y cuánto, para que el inventario baje solo al venderlo.
          </p>
        )}

        {!ventaDirecta && (
          <MobileIngredientEditor
            ingredientes={ingredientes}
            onChange={setIngredientes}
            products={products}
          />
        )}
      </div>

      {/* Pie fijo */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-line bg-surface shrink-0">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={guardar}
          disabled={guardarReceta.isPending}
          className="flex-[2]"
        >
          {guardarReceta.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando…
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" /> Guardar
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
}
