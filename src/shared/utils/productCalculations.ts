// utils/productCalculations.ts
import { Ingredient, Product } from '@odin6/types';

export const calculateMixedProductCost = (
  ingredients: Ingredient[],
  baseProducts: Product[],
): number => {
  let totalCost = 0;

  ingredients.forEach((ingredient) => {
    const baseProduct = baseProducts.find((p) => p.id === ingredient.productId);

    if (!baseProduct || !baseProduct.cost || !baseProduct.presentationQuantity)
      return 0;

    // Convertir a unidades compatibles
    const convertedQuantity = convertUnits(
      ingredient.quantity,
      ingredient.unit,
      baseProduct.presentation!,
    );

    // Calcular cantidad con merma
    const quantityWithWaste =
      convertedQuantity * (1 + ingredient.wastePercentage / 100);

    // Calcular costo proporcional
    const unitCost = baseProduct.cost / baseProduct.presentationQuantity!;
    const ingredientCost = quantityWithWaste * unitCost;

    totalCost += ingredientCost;
  });

  return parseFloat(totalCost.toFixed(2));
};

// utils/unitConversions.ts
const UNIT_CONVERSIONS: Record<string, number> = {
  // Abreviaciones
  'kg-g': 1000,
  'g-kg': 0.001,
  'l-ml': 1000,
  'ml-l': 0.001,
  // Nombres completos del enum ProductPresentationEnum
  'kilogramo-gramo': 1000,
  'gramo-kilogramo': 0.001,
  'litro-mililitro': 1000,
  'mililitro-litro': 0.001,
  // Cruzados (ingrediente en g/ml, presentación en nombre completo y viceversa)
  'gramo-kg': 0.001,
  'kg-gramo': 1000,
  'kilogramo-g': 1000,
  'g-kilogramo': 0.001,
  'mililitro-l': 0.001,
  'l-mililitro': 1000,
  'litro-ml': 1000,
  'ml-litro': 0.001,
  // Unidad compatible consigo misma en distintos formatos
  'unidad-unidad': 1,
};

export const convertUnits = (
  quantity: number,
  fromUnit: string,
  toUnit: string,
): number => {
  if (fromUnit === toUnit) return quantity;

  const conversionKey = `${fromUnit.toLowerCase()}-${toUnit.toLowerCase()}`;
  const factor = UNIT_CONVERSIONS[conversionKey];

  return factor ? quantity * factor : quantity;
};
