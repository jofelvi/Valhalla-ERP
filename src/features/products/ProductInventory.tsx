import {
  Control,
  Controller,
  FieldErrors,
  UseFormRegister,
  UseFormWatch,
  UseFormSetValue,
} from 'react-hook-form';
import { AlertTriangle, Loader2, Warehouse } from 'lucide-react';
import { ProductFormData } from '@/features/types/schemaYup/productSchema';
import { Category } from '@odin6/types';
import { Input } from '@/components/shared/input/input';
import SearchableSelect from '@/components/shared/searchableSelect/SearchableSelect';

interface ProductInventoryProps {
  register: UseFormRegister<ProductFormData>;
  errors: FieldErrors<ProductFormData>;
  control: Control<ProductFormData>;
  watch: UseFormWatch<ProductFormData>;
  setValue: UseFormSetValue<ProductFormData>;
  /** Todas las categorías: de aquí salen las subcategorías (las que tienen `parentId`). */
  categories: Category[];
  /** Stock REAL del almacén de la estación: lo que ve el mesonero. */
  stockReal?: number | null;
  /** Nombre del almacén donde vive ese stock (Barra, Cocina, Depósito…). */
  almacenNombre?: string | null;
  cargandoStock?: boolean;
  /** Abre el diálogo de conteo: el único camino que mueve stock con rastro. */
  onRegistrarConteo?: () => void;
  esNuevo?: boolean;
}

const CRITICIDAD = [
  {
    valor: 'ALTA',
    titulo: 'Alta',
    ayuda: 'Sin esto no se puede vender: carnes, quesos, masa, cerveza',
    clase: 'border-danger bg-danger/10 text-danger',
  },
  {
    valor: 'MEDIA',
    titulo: 'Media',
    ayuda: 'Importante, pero hay margen de maniobra',
    clase: 'border-warn bg-warn/10 text-warn',
  },
  {
    valor: 'BAJA',
    titulo: 'Baja',
    ayuda: 'Condimentos, hielo: que falte no detiene la venta',
    clase: 'border-ok bg-ok/10 text-ok',
  },
] as const;

/**
 * Inventario de un INSUMO.
 *
 * El campo "Stock" editable desapareció a propósito: `product.stock` lleva
 * congelado desde la migración y nadie lo lee para decidir disponibilidad — el
 * mesonero ve `warehouse_stocks`. Tener los dos números en pantalla llevaba a
 * discutir cuál era el bueno. Aquí se muestra EL que manda, en solo lectura, y
 * para cambiarlo se registra un conteo, que deja movimiento en el kardex con
 * autor y fecha.
 */
export default function ProductInventory({
  register,
  errors,
  control,
  watch,
  setValue,
  categories,
  stockReal,
  almacenNombre,
  cargandoStock,
  onRegistrarConteo,
  esNuevo,
}: ProductInventoryProps) {
  const categoriaElegida = watch('categoryId') || '';
  // Subcategorías = categorías cuyo `parentId` es la categoría elegida.
  const subcategorias = categoriaElegida
    ? categories.filter((c) => c.parentId === categoriaElegida)
    : [];

  return (
    <>
      {/* Subcategoría del insumo — solo si su categoría tiene subcategorías */}
      <div className="md:col-span-2">
        <SearchableSelect
          id="subcategoryId"
          label="Subcategoría (opcional)"
          options={subcategorias.map((c) => ({ value: c.id, label: c.name }))}
          value={watch('subcategoryId') || ''}
          onChange={(val) =>
            setValue('subcategoryId', val || null, { shouldValidate: true })
          }
          error={errors.subcategoryId?.message}
          placeholder={
            !categoriaElegida
              ? 'Elige primero una categoría'
              : subcategorias.length === 0
                ? 'Esta categoría no tiene subcategorías'
                : 'Seleccionar subcategoría…'
          }
          searchPlaceholder="Buscar subcategoría..."
          disabled={!categoriaElegida || subcategorias.length === 0}
          className="w-full"
        />
        <p className="text-xs text-dim mt-1">
          Agrupa insumos dentro de su categoría. Para crear subcategorías, marca
          una categoría padre al editarla.
        </p>
      </div>

      {/* Stock real por almacén — solo lectura */}
      <div className="md:col-span-2 p-4 rounded-xl border border-line bg-page">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-elevated">
              <Warehouse className="w-4 h-4 text-dim" />
            </div>
            <div>
              <p className="text-sm font-semibold text-content">
                Stock en {almacenNombre ?? 'el almacén de su estación'}
              </p>
              {cargandoStock ? (
                <p className="flex items-center gap-1.5 text-xs text-dim mt-0.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Consultando…
                </p>
              ) : esNuevo ? (
                <p className="text-xs text-dim mt-0.5">
                  Al guardar podrás cargar su inventario con un conteo.
                </p>
              ) : (
                <p className="text-xs text-dim mt-0.5">
                  {typeof stockReal === 'number'
                    ? 'Es el número que ve el mesonero al vender.'
                    : `Sin registro en ${almacenNombre ?? 'el almacén'}: el mesonero lo ve en 0.`}
                </p>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <p
              className={`text-2xl font-bold ${
                typeof stockReal === 'number' && stockReal <= 0
                  ? 'text-danger'
                  : 'text-content'
              }`}
            >
              {cargandoStock ? '—' : (stockReal ?? 0)}
            </p>
            {!esNuevo && onRegistrarConteo && (
              <button
                type="button"
                onClick={onRegistrarConteo}
                className="text-xs font-semibold text-brand hover:underline mt-0.5"
              >
                Registrar conteo
              </button>
            )}
          </div>
        </div>

        {typeof stockReal === 'number' && stockReal < 0 && (
          <p className="flex items-start gap-2 text-xs text-danger mt-3 pt-3 border-t border-line">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            En negativo: se ha vendido sin que se cargara la compra. Hasta que
            se haga un conteo, este número no sirve para decidir nada.
          </p>
        )}
      </div>

      {/* Criticidad — decide si el POS avisa "Agotado" */}
      <div className="md:col-span-2">
        <label className="block text-sm font-semibold mb-1 text-dim">
          ¿Cuánto duele que falte?
        </label>
        <p className="text-xs text-dim mb-2">
          Alta y Media hacen que el punto de venta avise “Agotado”. Baja solo
          informa.
        </p>
        <Controller
          name="criticality"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-3 gap-2">
              {CRITICIDAD.map((c) => {
                const activo = field.value === c.valor;
                return (
                  <button
                    key={c.valor}
                    type="button"
                    onClick={() => field.onChange(activo ? null : c.valor)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      activo
                        ? c.clase
                        : 'border-line bg-page text-dim hover:border-dim/50'
                    }`}
                  >
                    <span className="block text-sm font-bold">{c.titulo}</span>
                    <span className="block text-[11px] mt-0.5 opacity-80 leading-tight">
                      {c.ayuda}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        />
      </div>

      <Input
        label="Stock Mínimo"
        id="minStock"
        type="number"
        step="any"
        variant="numeric"
        {...register('minStock')}
        error={errors.minStock?.message}
        textHelper="Por debajo de esto entra en la lista de compras"
      />

      <Input
        label="Código de Barras"
        id="barcode"
        {...register('barcode')}
        error={errors.barcode?.message}
        placeholder="Se puede escanear en la barra"
      />

      <Input
        label="SKU"
        id="sku"
        {...register('sku')}
        error={errors.sku?.message}
        placeholder="Código interno (opcional)"
      />
    </>
  );
}
