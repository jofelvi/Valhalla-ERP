import {
  FieldErrors,
  UseFormRegister,
  UseFormWatch,
  UseFormSetValue,
} from 'react-hook-form';
import { Category } from '@odin6/types';
import { ProductFormData } from '@/features/types/schemaYup/productSchema';
import { ProductStationEnum } from '@/shared';
import { Input } from '@/components/shared/input/input';
import SearchableSelect from '@/components/shared/searchableSelect/SearchableSelect';
import { Button } from '@/components/shared/button/Button';
import { ChefHat, Wine, Layers, Pizza } from 'lucide-react';

interface ProductBasicInfoProps {
  register: UseFormRegister<ProductFormData>;
  errors: FieldErrors<ProductFormData>;
  categories: Category[];
  onAddCategory: () => void;
  watch: UseFormWatch<ProductFormData>;
  setValue: UseFormSetValue<ProductFormData>;
}

export default function ProductBasicInfo({
  register,
  errors,
  categories,
  onAddCategory,
  watch,
  setValue,
}: ProductBasicInfoProps) {
  const selectedStation = watch('station');

  return (
    <>
      {/* Nombre */}
      <Input
        label="Nombre *"
        id="name"
        {...register('name')}
        error={errors.name?.message}
      />
      {/* Categoría */}
      <div>
        <SearchableSelect
          id="categoryId"
          label="Categoría *"
          // Solo categorías raíz: las que tienen `parentId` son subcategorías y
          // se eligen aparte, en la sección de Inventario del insumo.
          options={categories
            .filter((c) => !c.parentId)
            .map((c) => ({ value: c.id, label: c.name }))}
          value={watch('categoryId') || ''}
          onChange={(val) => {
            setValue('categoryId', val, { shouldValidate: true });
            // Al cambiar de categoría, la subcategoría anterior ya no pertenece.
            setValue('subcategoryId', null, { shouldValidate: false });
          }}
          error={errors.categoryId}
          placeholder="Seleccionar Categoría..."
          searchPlaceholder="Buscar categoría..."
          className="w-full"
        />
        <div className="mt-2">
          <Button
            type="button"
            onClick={onAddCategory}
            variant="outline"
            size="sm"
            className="bg-surface/80 border-line text-dim hover:bg-elevated hover:border-line"
          >
            + Agregar nueva categoría
          </Button>
        </div>
      </div>

      {/* Descripción */}
      <div className="md:col-span-2">
        <label
          htmlFor="description"
          className="block text-sm font-semibold mb-2 text-dim"
        >
          Descripción
        </label>
        <textarea
          id="description"
          {...register('description')}
          rows={3}
          placeholder="Describe las características del producto..."
          className="w-full rounded-xl border border-line bg-page py-3 px-4 text-sm shadow-sm transition-all duration-200 placeholder:text-dim/60 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand resize-none"
        />
      </div>
      {/* La naturaleza (Insumo / Preparado / Servicio) la elige
          ProductTypeSelector, arriba del formulario: es la decisión que manda
          sobre qué campos tienen sentido y qué se descuenta al vender. */}

      {/* Estación de preparación */}
      <div className="md:col-span-2">
        <label className="block text-sm font-semibold mb-3 text-dim">
          Estación de Preparación
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Sin estación */}
          <button
            type="button"
            onClick={() => setValue('station', null)}
            className={`group relative flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 active:scale-[0.98] ${
              !selectedStation
                ? 'border-dim bg-dim/10 text-content shadow-sm'
                : 'border-line bg-page text-dim hover:border-dim/50 hover:bg-surface'
            }`}
          >
            <div
              className={`p-2.5 rounded-full transition-colors ${!selectedStation ? 'bg-dim/20' : 'bg-elevated group-hover:bg-dim/10'}`}
            >
              <Layers
                className={`w-6 h-6 ${!selectedStation ? 'text-content' : 'text-dim'}`}
              />
            </div>
            <span className="text-xs font-semibold tracking-wide">
              Sin asignar
            </span>
          </button>

          {/* Cocina */}
          <button
            type="button"
            onClick={() => setValue('station', ProductStationEnum.KITCHEN)}
            className={`group relative flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 active:scale-[0.98] ${
              selectedStation === ProductStationEnum.KITCHEN
                ? 'border-accent bg-accent/10 text-accent shadow-sm'
                : 'border-line bg-page text-dim hover:border-accent/30 hover:bg-accent/5'
            }`}
          >
            <div
              className={`p-2.5 rounded-full transition-colors ${selectedStation === ProductStationEnum.KITCHEN ? 'bg-accent/20' : 'bg-elevated group-hover:bg-accent/10'}`}
            >
              <ChefHat
                className={`w-6 h-6 ${selectedStation === ProductStationEnum.KITCHEN ? 'text-accent' : 'text-dim group-hover:text-accent/70'}`}
              />
            </div>
            <span className="text-xs font-semibold tracking-wide">Cocina</span>
          </button>

          {/* Barra */}
          <button
            type="button"
            onClick={() => setValue('station', ProductStationEnum.BAR)}
            className={`group relative flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 active:scale-[0.98] ${
              selectedStation === ProductStationEnum.BAR
                ? 'border-brand bg-brand/10 text-brand shadow-sm'
                : 'border-line bg-page text-dim hover:border-brand/30 hover:bg-brand/5'
            }`}
          >
            <div
              className={`p-2.5 rounded-full transition-colors ${selectedStation === ProductStationEnum.BAR ? 'bg-brand/20' : 'bg-elevated group-hover:bg-brand/10'}`}
            >
              <Wine
                className={`w-6 h-6 ${selectedStation === ProductStationEnum.BAR ? 'text-brand' : 'text-dim group-hover:text-brand/70'}`}
              />
            </div>
            <span className="text-xs font-semibold tracking-wide">Barra</span>
          </button>

          {/* Pizza */}
          <button
            type="button"
            onClick={() => setValue('station', ProductStationEnum.PIZZA)}
            className={`group relative flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 active:scale-[0.98] ${
              selectedStation === ProductStationEnum.PIZZA
                ? 'border-warn bg-warn/10 text-warn shadow-sm'
                : 'border-line bg-page text-dim hover:border-warn/30 hover:bg-warn/5'
            }`}
          >
            <div
              className={`p-2.5 rounded-full transition-colors ${selectedStation === ProductStationEnum.PIZZA ? 'bg-warn/20' : 'bg-elevated group-hover:bg-warn/10'}`}
            >
              <Pizza
                className={`w-6 h-6 ${selectedStation === ProductStationEnum.PIZZA ? 'text-warn' : 'text-dim group-hover:text-warn/70'}`}
              />
            </div>
            <span className="text-xs font-semibold tracking-wide">Pizza</span>
          </button>
        </div>
        {errors.station && (
          <p className="text-danger text-xs mt-1">{errors.station.message}</p>
        )}
      </div>

      {/* Estado para venta */}
      <label
        htmlFor="isForSale"
        className={`flex items-center space-x-4 p-4 rounded-xl border transition-all duration-300 cursor-pointer select-none group ${
          watch('isForSale')
            ? 'bg-brand/5 border-brand/40 shadow-sm'
            : 'bg-page border-line hover:border-brand/30 hover:bg-surface'
        }`}
      >
        <div className="relative flex items-center justify-center shrink-0">
          <input
            type="checkbox"
            id="isForSale"
            {...register('isForSale')}
            className="peer appearance-none w-5 h-5 border-2 border-line rounded bg-surface checked:bg-brand checked:border-brand transition-colors duration-200 focus:ring-2 focus:ring-brand/30 focus:outline-none cursor-pointer"
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
            className={`text-sm font-semibold transition-colors ${watch('isForSale') ? 'text-brand' : 'text-content'}`}
          >
            Disponible para Venta
          </span>
          <span className="text-xs text-dim mt-0.5">
            Muestra el producto en el catálogo principal
          </span>
        </div>
      </label>

      {/* El toggle "Insumo de inventario" ya no existe: decía lo mismo que la
          naturaleza por otra vía y se contradecían. Un preparado marcado
          "insumo" descontaba un stock fantasma de sí mismo en vez de sus
          ingredientes — así los tobos vaciaban un producto que no existía. */}
    </>
  );
}
