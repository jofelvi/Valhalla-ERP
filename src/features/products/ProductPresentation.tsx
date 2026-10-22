import { useEffect } from 'react';
import {
  Control,
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from 'react-hook-form';
import { ProductFormData } from '../types/schemaYup/productSchema';
import { ProductPresentationEnum } from '@/shared';
import SelectCustom from '@/components/shared/selectCustom/SelectCustom';
import {
  defaultQuantities,
  presentationLabels,
} from '@/features/products/productsUtils';
import { Input } from '@/components/shared/input/input';
import { baseDeUnidad } from '@/shared/utils/costoDeLinea';

interface ProductPresentationProps {
  control: Control<ProductFormData>;
  register: UseFormRegister<ProductFormData>;
  errors: FieldErrors<ProductFormData>;
  watch: UseFormWatch<ProductFormData>;
  setValue: UseFormSetValue<ProductFormData>;
}

export default function ProductPresentation({
  register,
  errors,
  watch,
  setValue,
}: ProductPresentationProps) {
  const presentation = watch('presentation');
  const presentationQuantity = watch('presentationQuantity');
  // Qué equivalencias tienen sentido según CÓMO se compra: cada una cruza la
  // familia de compra con otra en la que una receta podría pedirlo.
  const base = baseDeUnidad(presentation);

  useEffect(() => {
    if (!presentationQuantity && presentation) {
      setValue('presentationQuantity', defaultQuantities[presentation]);
    }
  }, [presentation, presentationQuantity, setValue, watch]);

  return (
    <>
      {/* Tipo de Presentación */}
      <SelectCustom<ProductFormData>
        id="presentation"
        name="presentation"
        label="Presentación"
        register={register}
        options={Object.values(ProductPresentationEnum).map((value) => ({
          value,
          label: `${value} - ${presentationLabels[value]}`,
        }))}
        error={errors.presentation?.message}
      />
      {/* Cantidad por Presentación */}
      <Input
        id="presentationQuantity"
        type="number"
        min={0.01}
        step={0.01}
        variant="numeric"
        label="Contenido de la Unidad de Compra"
        {...register('presentationQuantity')}
        error={errors.presentationQuantity?.message}
        textHelper="Cuánto trae lo que compras, en la unidad de arriba. Ej: saco de harina = 45 (kg), lata de aceitunas = 3 (kg), cartón de huevos = 30 (unidades), paquete de levadura = 500 (gramos)"
      />

      {/* Equivalencias: sin ellas, una receta en otra familia de unidad
          (ml de algo que se compra por gramos) no se puede costear ni descontar */}
      <div className="md:col-span-2 rounded-xl border border-line bg-page p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-content">
            Equivalencias (opcional)
          </p>
          <p className="text-xs text-dim mt-0.5">
            Solo si alguna receta lo pide en otra medida que la de compra. Sin
            esto, esa línea no suma al costo ni descuenta inventario.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {base !== 'UND' && (
            <Input
              id="gramsPerMl"
              type="number"
              min={0.0001}
              step="any"
              variant="numeric"
              label="1 ml equivale a (gramos)"
              {...register('gramsPerMl')}
              error={errors.gramsPerMl?.message}
              textHelper={
                base === 'GR'
                  ? 'Si la receta lo pide en ml o litros. Ej: leche en polvo, 100 ml llevan 12 g → 0.12'
                  : 'Si la receta lo pide en gramos. Ej: aceite → 0.92'
              }
            />
          )}
          {base !== 'ML' && (
            <Input
              id="gramsPerUnit"
              type="number"
              min={0.0001}
              step="any"
              variant="numeric"
              label="1 unidad pesa (gramos)"
              {...register('gramsPerUnit')}
              error={errors.gramsPerUnit?.message}
              textHelper={
                base === 'UND'
                  ? 'Si la receta lo pide en gramos. Ej: un huevo → 55'
                  : 'Si la receta lo pide por unidades. Ej: una cebolla → 150'
              }
            />
          )}
          {base !== 'GR' && (
            <Input
              id="mlPerUnit"
              type="number"
              min={0.0001}
              step="any"
              variant="numeric"
              label="1 unidad tiene (ml)"
              {...register('mlPerUnit')}
              error={errors.mlPerUnit?.message}
              textHelper={
                base === 'UND'
                  ? 'Si la receta lo pide en ml. Ej: una lata de refresco → 355'
                  : 'Si la receta lo pide por unidades. Ej: un limón rinde 30 ml de jugo'
              }
            />
          )}
        </div>
      </div>

      {/* Estado Activo */}
      <label
        htmlFor="isActive"
        className={`flex items-center space-x-4 p-4 rounded-xl border transition-all duration-300 cursor-pointer select-none group ${
          watch('isActive')
            ? 'bg-ok/5 border-ok/40 shadow-sm'
            : 'bg-page border-line hover:border-ok/30 hover:bg-surface'
        }`}
      >
        <div className="relative flex items-center justify-center shrink-0">
          <input
            type="checkbox"
            id="isActive"
            {...register('isActive')}
            className="peer appearance-none w-5 h-5 border-2 border-line rounded bg-surface checked:bg-ok checked:border-ok transition-colors duration-200 focus:ring-2 focus:ring-ok/30 focus:outline-none cursor-pointer"
          />
          <svg
            className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity duration-200"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div className="flex flex-col">
          <span
            className={`text-sm font-semibold transition-colors ${watch('isActive') ? 'text-ok' : 'text-content'}`}
          >
            Producto Activo
          </span>
          <span className="text-xs text-dim mt-0.5">
            Visible y disponible en el sistema
          </span>
        </div>
      </label>
    </>
  );
}
