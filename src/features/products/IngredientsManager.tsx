import { ProductFormData } from '@/features/types/schemaYup/productSchema';
import {
  Control,
  FieldErrors,
  useFieldArray,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from 'react-hook-form';
import { Product } from '@odin6/types';
import SearchableSelect from '@/components/shared/searchableSelect/SearchableSelect';
import { Button } from '@/components/shared/button/Button';
import { AlertCircle, Package, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { costoDeLinea } from '@/shared/utils/costoDeLinea';
import { ProductPresentationEnum, ProductTypeEnum } from '@/shared';
import { esEnvasado, medidasPara } from './naturaleza';
import { sonUnidadesCompatibles } from '@/shared/utils/unidades';

export interface IngredientsManagerProps {
  control: Control<ProductFormData>;
  register: UseFormRegister<ProductFormData>;
  errors: FieldErrors<ProductFormData>;
  watch: UseFormWatch<ProductFormData>;
  setValue: UseFormSetValue<ProductFormData>;
  products: Product[];
}

const presentationLabels: Record<ProductPresentationEnum, string> = {
  [ProductPresentationEnum.UNIT]: 'Unidad',
  [ProductPresentationEnum.BOX]: 'Caja',
  [ProductPresentationEnum.PACK]: 'Paquete',
  [ProductPresentationEnum.BAG]: 'Bolsa',
  [ProductPresentationEnum.BOTTLE]: 'Botella',
  [ProductPresentationEnum.CAN]: 'Lata',
  [ProductPresentationEnum.CONTAINER]: 'Envase',
  [ProductPresentationEnum.JAR]: 'Frasco',
  [ProductPresentationEnum.DOZEN]: 'Docena',
  [ProductPresentationEnum.HALF_DOZEN]: 'Media Doc.',
  [ProductPresentationEnum.KILOGRAM]: 'Kg',
  [ProductPresentationEnum.GRAM]: 'g',
  [ProductPresentationEnum.LITER]: 'Litro',
  [ProductPresentationEnum.MILLILITER]: 'ml',
  [ProductPresentationEnum.GALLON]: 'Galón',
  [ProductPresentationEnum.BULK]: 'Bulto',
  [ProductPresentationEnum.ROLL]: 'Rollo',
  [ProductPresentationEnum.PLATE]: 'Plato',
};

export default function IngredientsManager({
  control,
  register,
  errors,
  watch,
  setValue,
  products,
}: IngredientsManagerProps) {
  const productType = watch('type');
  const ingredients = watch('ingredients');

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'ingredients',
  });

  // Cualquier producto activo puede ser ingrediente: la Masa de Pizza es un
  // COMPUESTO y se usa en 24 recetas. Se excluyen los SERVICIOS, que por
  // definición no salen del almacén.
  const availableProducts = useMemo(
    () =>
      products.filter(
        (p) => p.isActive !== false && p.type !== ProductTypeEnum.SERVICE,
      ),
    [products],
  );

  const productOptions = useMemo(
    () => availableProducts.map((p) => ({ value: p.id, label: p.name })),
    [availableProducts],
  );

  // Costo de una línea CON su estado: antes una unidad incompatible devolvía
  // 0 en silencio y la receta parecía costar menos de lo que cuesta.
  const getLinea = (
    productId: string,
    quantity: number,
    unit: string,
    wastePercentage: number,
  ) => {
    const product = availableProducts.find((p: Product) => p.id === productId);
    if (!product || !quantity) return null;
    return costoDeLinea(product, quantity, unit, wastePercentage || 0);
  };

  const getIngredientCost = (
    productId: string,
    quantity: number,
    unit: string,
    wastePercentage: number,
  ) => getLinea(productId, quantity, unit, wastePercentage)?.costo ?? 0;

  // Líneas que NO suman al costo (unidad que no cruza, o insumo sin precio).
  const lineasSinCostear = (ingredients ?? []).filter((ing) => {
    if (!ing.productId || !ing.quantity) return false;
    const l = getLinea(
      ing.productId,
      ing.quantity,
      ing.unit || ProductPresentationEnum.UNIT,
      ing.wastePercentage ?? 0,
    );
    return l !== null && l.estado !== 'ok';
  }).length;

  const totalCost = (() => {
    if (!ingredients || ingredients.length === 0) return 0;

    return ingredients.reduce((total, ing) => {
      if (!ing.productId || !ing.quantity) return total;
      return (
        total +
        getIngredientCost(
          ing.productId,
          ing.quantity,
          ing.unit || ProductPresentationEnum.UNIT,
          ing.wastePercentage ?? 10,
        )
      );
    }, 0);
  })();

  useEffect(() => {
    if (productType === ProductTypeEnum.MIXED) {
      setValue('cost', totalCost);
    }
  }, [totalCost, productType, setValue]);

  const addIngredient = () => {
    append({
      productId: '',
      quantity: 1,
      unit: ProductPresentationEnum.GRAM,
      // Merma 0 por defecto: el 10 % que había se aplicaba también a latas y
      // botellas, que no se derraman al servirlas (48 recetas así el 03/09).
      wastePercentage: 0,
    });
  };

  if (productType !== ProductTypeEnum.MIXED) {
    return null;
  }

  return (
    <div className="md:col-span-2">
      <div className="bg-surface border border-line rounded-xl shadow-sm">
        {/* Header */}
        <div className="bg-gradient-to-r from-page to-elevated border-b border-line px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-8 h-8 bg-elevated rounded-lg">
                <Package className="w-4 h-4 text-brand" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-content">
                  Ingredientes
                </h3>
                <p className="text-sm text-dim">
                  {fields.length} ingrediente{fields.length !== 1 ? 's' : ''}
                  {' · '}
                  Costo total:{' '}
                  <span className="font-semibold text-ok">
                    ${totalCost.toFixed(2)}
                  </span>
                  {lineasSinCostear > 0 && (
                    <span className="ml-2 font-semibold text-danger">
                      · {lineasSinCostear} línea
                      {lineasSinCostear !== 1 ? 's' : ''} sin costear (el total
                      queda corto)
                    </span>
                  )}
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={addIngredient}
              className="bg-gradient-to-r from-brand to-brand/80 hover:from-brand/90 hover:to-brand/70 text-on-brand shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Agregar
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="p-4">
          {fields.length === 0 ? (
            <div className="text-center py-10">
              <Package className="w-10 h-10 text-dim mx-auto mb-3" />
              <p className="text-dim text-sm mb-4">
                Agrega al menos un ingrediente
              </p>
              <Button
                type="button"
                onClick={addIngredient}
                className="bg-gradient-to-r from-brand to-brand/80 hover:from-brand/90 hover:to-brand/70 text-on-brand shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Agregar ingrediente
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs font-semibold text-dim uppercase tracking-wider">
                    <th
                      className="text-left pb-3 pl-2"
                      style={{ minWidth: 220 }}
                    >
                      Producto
                    </th>
                    <th className="text-center pb-3" style={{ width: 90 }}>
                      Cant.
                    </th>
                    <th className="text-center pb-3" style={{ width: 120 }}>
                      Unidad
                    </th>
                    <th className="text-center pb-3" style={{ width: 80 }}>
                      Merma %
                    </th>
                    <th className="text-right pb-3" style={{ width: 90 }}>
                      Costo
                    </th>
                    <th className="pb-3" style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {fields.map((field, index) => {
                    const ingredient = watch(`ingredients.${index}`);
                    const selectedProduct = availableProducts.find(
                      (p) => p.id === ingredient?.productId,
                    );
                    const linea =
                      ingredient?.productId && ingredient?.quantity
                        ? getLinea(
                            ingredient.productId,
                            ingredient.quantity,
                            ingredient.unit || ProductPresentationEnum.UNIT,
                            ingredient.wastePercentage ?? 0,
                          )
                        : null;
                    const cost = linea?.costo ?? 0;
                    const isCompatible =
                      !selectedProduct ||
                      !ingredient?.unit ||
                      sonUnidadesCompatibles(
                        ingredient.unit,
                        selectedProduct?.presentation,
                        selectedProduct,
                      );

                    return (
                      <tr
                        key={field.id}
                        className={`group ${
                          !isCompatible
                            ? 'bg-danger/10 hover:bg-danger/15 border-l-4 border-danger'
                            : 'hover:bg-elevated/50'
                        }`}
                      >
                        {/* Producto */}
                        <td className="py-2 pl-2 pr-2 align-top">
                          <SearchableSelect
                            id={`ingredients.${index}.productId`}
                            options={productOptions}
                            value={ingredient?.productId || ''}
                            onChange={(val) =>
                              setValue(`ingredients.${index}.productId`, val, {
                                shouldValidate: true,
                              })
                            }
                            error={
                              errors.ingredients?.[index]?.productId?.message
                            }
                            placeholder="Buscar producto..."
                            searchPlaceholder="Buscar producto base..."
                          />
                          {selectedProduct && (
                            <span className="text-[10px] text-dim mt-0.5 block">
                              {
                                presentationLabels[
                                  selectedProduct.presentation as ProductPresentationEnum
                                ]
                              }
                              {' · Compra: $'}
                              {(selectedProduct.cost ?? 0).toFixed(2)}
                            </span>
                          )}
                        </td>

                        {/* Cantidad */}
                        <td className="py-2 px-1 align-top">
                          <input
                            type="number"
                            step="0.001"
                            min={0.001}
                            {...register(`ingredients.${index}.quantity`, {
                              valueAsNumber: true,
                            })}
                            className="w-full h-11 rounded-xl border border-line bg-surface/90 px-2 text-sm text-center shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                          />
                        </td>

                        {/* Medida — SOLO las compatibles con este insumo */}
                        <td className="py-2 px-1 align-top">
                          <select
                            {...register(`ingredients.${index}.unit`)}
                            disabled={!selectedProduct}
                            className="w-full h-11 rounded-xl border border-line bg-surface/90 px-2 text-sm shadow-sm appearance-none cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                          >
                            {/* Ofrecer las 18 presentaciones a cualquier
                                insumo permitía guardar mililitros de algo
                                comprado por Unidad: la receta se guardaba y
                                NUNCA descontaba (12 recetas así el 03/09).
                                Aquí solo aparecen las que su presentación
                                admite. */}
                            {medidasPara(
                              selectedProduct?.presentation,
                              selectedProduct,
                            ).opciones.map((u) => (
                              <option key={u} value={u}>
                                {presentationLabels[
                                  u as ProductPresentationEnum
                                ] ?? u}
                              </option>
                            ))}
                          </select>
                          {selectedProduct && !isCompatible && (
                            <span className="text-danger text-[10px] flex items-start mt-0.5 leading-tight">
                              <AlertCircle className="w-3 h-3 mr-0.5 shrink-0 mt-0.5" />
                              {linea?.mensaje ??
                                `${selectedProduct.name}: unidad que no se puede convertir`}
                            </span>
                          )}
                          {selectedProduct && linea?.estado === 'sin-costo' && (
                            <span className="text-warn text-[10px] flex items-start mt-0.5 leading-tight">
                              <AlertCircle className="w-3 h-3 mr-0.5 shrink-0 mt-0.5" />
                              {linea.mensaje}
                            </span>
                          )}
                        </td>

                        {/* Merma */}
                        <td className="py-2 px-1 align-top">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            defaultValue={0}
                            {...register(
                              `ingredients.${index}.wastePercentage`,
                              {
                                valueAsNumber: true,
                              },
                            )}
                            className="w-full h-11 rounded-xl border border-line bg-surface/90 px-2 text-sm text-center shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                          />
                          {esEnvasado(selectedProduct?.presentation) &&
                            (ingredient?.wastePercentage ?? 0) > 0 && (
                              <span className="text-warn text-[10px] flex items-start mt-0.5 leading-tight">
                                <AlertCircle className="w-3 h-3 mr-0.5 shrink-0 mt-0.5" />
                                Una lata no se derrama: la merma aquí resta
                                stock que no se gastó
                              </span>
                            )}
                        </td>

                        {/* Costo */}
                        <td className="py-2 px-1 align-top">
                          <div
                            className={`h-11 flex items-center justify-end px-2 rounded-xl bg-elevated border text-sm font-semibold ${
                              linea && linea.estado !== 'ok'
                                ? 'border-danger text-danger'
                                : 'border-line text-ok'
                            }`}
                            title={linea?.mensaje}
                          >
                            {linea && linea.estado !== 'ok'
                              ? 'sin costear'
                              : `$${cost.toFixed(2)}`}
                          </div>
                        </td>

                        {/* Eliminar */}
                        <td className="py-2 pl-1 align-top">
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="h-11 w-9 flex items-center justify-center rounded-xl text-dim hover:text-danger hover:bg-danger/10 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Footer con total */}
                <tfoot>
                  <tr className="border-t border-line">
                    <td
                      colSpan={4}
                      className="pt-3 pl-2 text-sm font-semibold text-dim text-right pr-2"
                    >
                      Total:
                    </td>
                    <td className="pt-3 px-1">
                      <div className="text-sm font-bold text-ok text-right pr-2">
                        ${totalCost.toFixed(2)}
                      </div>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
