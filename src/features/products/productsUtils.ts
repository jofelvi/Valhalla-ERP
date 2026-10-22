import { Ingredient, Product } from '@odin6/types';
import { ProductFormData } from '@/features/types/schemaYup/productSchema';
import {
  ProductPresentationEnum,
  ProductStationEnum,
  ProductTypeEnum,
} from '@/shared';
import { costoDeLinea } from '@/shared/utils/costoDeLinea';
import { api } from '@/services/api/apiClient';

export const calculateMixedProductCost = (
  ingredients: Ingredient[],
  products: Product[],
): number => {
  return ingredients.reduce((total, ingredient) => {
    const product = products.find((p) => p.id === ingredient.productId);
    if (!product) return total;

    // Misma aritmética que el servidor (conversión por equivalencias del
    // insumo incluida). NUNCA multiplicar crudo: eso produjo costos absurdos
    // (aceite 40gr x $4.30/L = $172 en un lote de masa). Una línea que no se
    // puede convertir se omite del costo y se avisa.
    const linea = costoDeLinea(
      product,
      ingredient.quantity,
      ingredient.unit,
      ingredient.wastePercentage || 0,
    );
    if (linea.estado === 'incompatible') {
      console.warn(`[costeo] ${linea.mensaje}`);
    }
    return total + linea.costo;
  }, 0);
};

/**
 * Recalcula el costo de todos los productos mixtos que usan un producto
 * como ingrediente. Se llama cuando cambia el precio de un producto.
 * Retorna la cantidad de productos actualizados.
 */
export const recalculateDependentMixedProducts = async (
  changedProductId: string,
  allProducts: Product[],
): Promise<number> => {
  const mixedProducts = allProducts.filter(
    (p) =>
      p.type === ProductTypeEnum.MIXED &&
      p.ingredients?.some((ing) => ing.productId === changedProductId),
  );

  if (mixedProducts.length === 0) return 0;

  const updatePromises = mixedProducts.map(async (mixedProduct) => {
    const newCost = calculateMixedProductCost(
      mixedProduct.ingredients!,
      allProducts,
    );

    if (Math.abs(newCost - (mixedProduct.cost || 0)) > 0.001) {
      await api.patch(`/api/products/${mixedProduct.id}`, {
        cost: newCost,
        updatedAt: new Date(),
      });
      return true;
    }
    return false;
  });

  const results = await Promise.all(updatePromises);
  return results.filter(Boolean).length;
};

export const mapProductToFormData = (
  product: Product,
): Partial<ProductFormData> => {
  return {
    name: product.name,
    description: product.description,
    price: product.price,
    type: product.type,
    categoryId: product.categoryId,
    subcategoryId: product.subcategoryId ?? null,
    supplierIds: product.supplierIds || [],
    isActive: product.isActive,
    isForSale: product.isForSale,
    cost: product.cost,
    sku: product.sku,
    barcode: product.barcode,
    minStock: product.minStock,
    criticality: product.criticality ?? null,
    presentation: product.presentation as ProductPresentationEnum,
    presentationQuantity: product.presentationQuantity || 1,
    gramsPerMl: product.gramsPerMl ?? null,
    gramsPerUnit: product.gramsPerUnit ?? null,
    mlPerUnit: product.mlPerUnit ?? null,
    imageUrl: product.imageUrl,
    ingredients: product.ingredients || [],
    station: product.station ?? null,
  };
};

// 2. Función para mapear FormData a Product
// Devuelve `Partial<Product>` (y no `Product`/`Omit<Product, 'id'>`) porque
// así es como lo consumen ambos call sites: `useCreateProduct`/
// `useUpdateProduct` esperan `Partial<Product>`. El formulario nunca envía
// `currency` (siempre USD, ver productSchema) ni `stock` (legacy: el stock
// real vive en warehouse_stocks y se cambia registrando un conteo), así que
// el objeto real jamás tuvo esas dos propiedades — el tipo ahora solo lo
// refleja.
export const mapFormDataToProduct = (
  formData: ProductFormData,
  id?: string,
): Partial<Product> => {
  const baseProduct = {
    name: formData.name,
    description: formData.description,
    price: formData.price,
    type: formData.type,
    categoryId: formData.categoryId,
    // La subcategoría solo tiene sentido en un INSUMO. Se manda null para el
    // resto; además el servidor la limpia por su cuenta (defensa en profundidad).
    subcategoryId:
      formData.type === ProductTypeEnum.BASE
        ? (formData.subcategoryId ?? null)
        : null,
    supplierIds: formData.supplierIds,
    isActive: formData.isActive,
    isForSale: formData.isForSale,
    // `isForInventory` NO se manda: lo deriva el servidor de `type`. Mandarlo
    // desde aquí era lo que permitía guardar un preparado marcado "insumo",
    // que descontaba un stock fantasma de sí mismo en vez de sus ingredientes.
    cost: formData.cost,
    sku: formData.sku,
    barcode: formData.barcode,
    minStock: formData.minStock,
    criticality: formData.criticality ?? null,
    presentation: formData.presentation,
    presentationQuantity: formData.presentationQuantity,
    // Equivalencias entre peso, volumen y unidad (solo las que se cargaron)
    gramsPerMl: formData.gramsPerMl ?? null,
    gramsPerUnit: formData.gramsPerUnit ?? null,
    mlPerUnit: formData.mlPerUnit ?? null,
    imageUrl: formData.imageUrl,
    // Ojo: para un insumo o un servicio se manda [] y NO null. Con null, un
    // producto BASE que tuviera receta cargada por script la perdía en cuanto
    // alguien abría su ficha y guardaba (pasó con 21 productos, los tobos
    // entre ellos).
    ingredients:
      formData.type === ProductTypeEnum.MIXED ? formData.ingredients : [],
    station: (formData.station as ProductStationEnum) ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return id ? { ...baseProduct, id } : baseProduct;
};

export const defaultQuantities: Record<ProductPresentationEnum, number> = {
  [ProductPresentationEnum.UNIT]: 1,
  [ProductPresentationEnum.BOX]: 12,
  [ProductPresentationEnum.PACK]: 6,
  [ProductPresentationEnum.BAG]: 1,
  [ProductPresentationEnum.BOTTLE]: 1,
  [ProductPresentationEnum.CAN]: 1,
  [ProductPresentationEnum.CONTAINER]: 1,
  [ProductPresentationEnum.JAR]: 1,
  [ProductPresentationEnum.DOZEN]: 12,
  [ProductPresentationEnum.HALF_DOZEN]: 6,
  [ProductPresentationEnum.KILOGRAM]: 1,
  [ProductPresentationEnum.GRAM]: 100, // 100 gramos por defecto
  [ProductPresentationEnum.LITER]: 1,
  [ProductPresentationEnum.MILLILITER]: 500, // 500ml por defecto
  [ProductPresentationEnum.GALLON]: 1,
  [ProductPresentationEnum.BULK]: 1,
  [ProductPresentationEnum.ROLL]: 1,
  [ProductPresentationEnum.PLATE]: 1,
};

export const presentationLabels = {
  [ProductPresentationEnum.UNIT]: 'Unidad individual',
  [ProductPresentationEnum.BOX]: 'Caja con múltiples unidades',
  [ProductPresentationEnum.PACK]: 'Paquete con múltiples unidades',
  [ProductPresentationEnum.BAG]: 'Bolsa con contenido variable',
  [ProductPresentationEnum.BOTTLE]: 'Botella con líquido o contenido',
  [ProductPresentationEnum.CAN]: 'Lata con contenido preservado',
  [ProductPresentationEnum.CONTAINER]: 'Envase o recipiente',
  [ProductPresentationEnum.JAR]: 'Frasco de vidrio o plástico',
  [ProductPresentationEnum.DOZEN]: 'Agrupación de 12 unidades',
  [ProductPresentationEnum.HALF_DOZEN]: 'Agrupación de 6 unidades',
  [ProductPresentationEnum.KILOGRAM]: 'Peso en kilogramos',
  [ProductPresentationEnum.GRAM]: 'Peso en gramos',
  [ProductPresentationEnum.LITER]: 'Volumen en litros',
  [ProductPresentationEnum.MILLILITER]: 'Volumen en mililitros',
  [ProductPresentationEnum.GALLON]: 'Volumen en galones',
  [ProductPresentationEnum.BULK]: 'Bulto o paquete grande',
  [ProductPresentationEnum.ROLL]: 'Rollo de material continuo',
  [ProductPresentationEnum.PLATE]: 'Plato o placa individual',
};
