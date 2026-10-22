import { ProductTypeEnum } from '@/shared/types/enumShared';
import { Product } from '@odin6/types';

export const calculateAvailableStock = (
  product: Product,
  allProducts: Product[],
): number => {
  if (product.type === ProductTypeEnum.BASE) {
    return product.stock;
  }

  if (!product.ingredients || product.ingredients.length === 0) {
    return 0;
  }

  return Math.min(
    ...product.ingredients.map(
      (ingredient: { productId: string; quantity: number }) => {
        const ingredientProduct = allProducts.find(
          (p) => p.id === ingredient.productId,
        );
        if (!ingredientProduct) return 0;
        return Math.floor(ingredientProduct.stock / ingredient.quantity);
      },
    ),
  );
};
