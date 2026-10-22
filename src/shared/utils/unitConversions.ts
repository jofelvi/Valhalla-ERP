import { ProductPresentationEnum } from '@/shared/types/enumShared';

export enum UnitCategory {
  WEIGHT = 'weight',
  VOLUME = 'volume',
  UNIT = 'unit',
  OTHER = 'other',
}

export const unitCategories: Record<ProductPresentationEnum, UnitCategory> = {
  [ProductPresentationEnum.UNIT]: UnitCategory.UNIT,
  [ProductPresentationEnum.BOX]: UnitCategory.UNIT,
  [ProductPresentationEnum.PACK]: UnitCategory.UNIT,
  [ProductPresentationEnum.BAG]: UnitCategory.UNIT,
  [ProductPresentationEnum.BOTTLE]: UnitCategory.UNIT,
  [ProductPresentationEnum.CAN]: UnitCategory.UNIT,
  [ProductPresentationEnum.CONTAINER]: UnitCategory.UNIT,
  [ProductPresentationEnum.JAR]: UnitCategory.UNIT,
  [ProductPresentationEnum.DOZEN]: UnitCategory.UNIT,
  [ProductPresentationEnum.HALF_DOZEN]: UnitCategory.UNIT,
  [ProductPresentationEnum.KILOGRAM]: UnitCategory.WEIGHT,
  [ProductPresentationEnum.GRAM]: UnitCategory.WEIGHT,
  [ProductPresentationEnum.LITER]: UnitCategory.VOLUME,
  [ProductPresentationEnum.MILLILITER]: UnitCategory.VOLUME,
  [ProductPresentationEnum.GALLON]: UnitCategory.VOLUME,
  [ProductPresentationEnum.BULK]: UnitCategory.OTHER,
  [ProductPresentationEnum.ROLL]: UnitCategory.OTHER,
  [ProductPresentationEnum.PLATE]: UnitCategory.OTHER,
};

export const conversionFactors: Record<ProductPresentationEnum, number> = {
  [ProductPresentationEnum.UNIT]: 1,
  [ProductPresentationEnum.BOX]: 1,
  [ProductPresentationEnum.PACK]: 1,
  [ProductPresentationEnum.BAG]: 1,
  [ProductPresentationEnum.BOTTLE]: 1,
  [ProductPresentationEnum.CAN]: 1,
  [ProductPresentationEnum.CONTAINER]: 1,
  [ProductPresentationEnum.JAR]: 1,
  [ProductPresentationEnum.DOZEN]: 12, // 1 docena = 12 unidades
  [ProductPresentationEnum.HALF_DOZEN]: 6, // 1/2 docena = 6 unidades
  [ProductPresentationEnum.KILOGRAM]: 1000, // 1 kg = 1000 g
  [ProductPresentationEnum.GRAM]: 1, // 1 g = 1 g (base)
  [ProductPresentationEnum.LITER]: 1000, // 1 L = 1000 ml
  [ProductPresentationEnum.MILLILITER]: 1, // 1 ml = 1 ml (base)
  [ProductPresentationEnum.GALLON]: 3785.41, // 1 galón = 3785.41 ml
  [ProductPresentationEnum.BULK]: 1,
  [ProductPresentationEnum.ROLL]: 1,
  [ProductPresentationEnum.PLATE]: 1,
};

export function areUnitsCompatible(
  unit1: ProductPresentationEnum,
  unit2: ProductPresentationEnum,
): boolean {
  return unitCategories[unit1] === unitCategories[unit2];
}

export function convertUnit(
  value: number,
  fromUnit: ProductPresentationEnum,
  toUnit: ProductPresentationEnum,
): number {
  if (!areUnitsCompatible(fromUnit, toUnit)) {
    throw new Error(`Incompatible units: ${fromUnit} and ${toUnit}`);
  }
  const baseValue = value * conversionFactors[fromUnit];
  return baseValue / conversionFactors[toUnit];
}

export function calculateIngredientCost(
  ingredientQuantity: number,
  ingredientUnit: ProductPresentationEnum,
  baseProductCost: number,
  baseProductUnit: ProductPresentationEnum,
  baseProductPresentationQty: number,
  wastePercentage: number,
): number {
  if (!areUnitsCompatible(ingredientUnit, baseProductUnit)) {
    throw new Error(
      `Unidades incompatibles: ${ingredientUnit} y ${baseProductUnit}`,
    );
  }
  const convertedQuantity = convertUnit(
    ingredientQuantity,
    ingredientUnit,
    baseProductUnit,
  );
  const costPerBaseUnit = baseProductCost / baseProductPresentationQty;
  return convertedQuantity * costPerBaseUnit * (1 + wastePercentage / 100);
}
