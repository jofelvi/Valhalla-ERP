/**
 * Packaging service — automatiza el cálculo y agregación de envases para pedidos para llevar.
 * Regla de negocio (decisión del dueño):
 * - 1 envase por cada UNIDAD de comida (station=KITCHEN, no es pizza, no empieza con "extra")
 * - 1 caja por cada PIZZA (categoryId = pizzasCategoryId)
 * - Bebidas (station=BAR) no llevan envase
 */

import { CartItem, OrderItem, Product } from '../types';

export const PACKAGING = {
  envase: {
    productId: 'FxWKjgzn8m34Tve3McmM',
    name: 'Envases para llevar mediano',
    price: 0.5,
  },
  cajaPizza: {
    productId: '0wz9eaS2zohbefvcE70v',
    name: 'Caja de Pizza',
    price: 1,
  },
  pizzasCategoryId: 'k1DX7qMeYXoo0y6RmLjz',
};

interface ProductInfo {
  categoryId?: string;
  station?: string | null;
  name: string;
}

interface PackagingResult {
  envaseQty: number;
  cajaQty: number;
}

interface ItemWithProductId {
  productId: string;
  quantity: number;
}

/**
 * Calcula la cantidad de envases y cajas necesarios basado en los items del carrito o orden.
 * @param items CartItem[] | OrderItem[] - items del carrito/orden actual
 * @param productLookup (productId: string) => ProductInfo - resuelve productId a info del producto
 * @returns { envaseQty, cajaQty } cantidades de envases y cajas
 */
export function computePackaging(
  items: CartItem[] | OrderItem[] | ItemWithProductId[],
  productLookup: (productId: string) => ProductInfo | undefined,
): PackagingResult {
  let envaseQty = 0;
  let cajaQty = 0;

  // Excluir productos de packaging para no hacer cálculo recursivo
  const packagingIds = new Set([
    PACKAGING.envase.productId,
    PACKAGING.cajaPizza.productId,
  ]);

  items.forEach((item) => {
    // Obtener productId según el tipo de item
    const productId = 'product' in item ? item.product.id : item.productId;
    const quantity = item.quantity;

    // Ignorar si es un producto de packaging
    if (packagingIds.has(productId)) {
      return;
    }

    const info = productLookup(productId);
    if (!info) {
      return;
    }

    // Regla 1: Pizza → suma a cajas
    if (info.categoryId === PACKAGING.pizzasCategoryId) {
      cajaQty += quantity;
      return;
    }

    // Regla 2: KITCHEN + no pizza + no empieza con "extra" → suma a envases
    if (info.station === 'KITCHEN') {
      const nameLC = info.name.toLowerCase();
      if (!nameLC.startsWith('extra')) {
        envaseQty += quantity;
      }
      return;
    }

    // Regla 3: BAR, station null/undefined, o packaging → no suman
  });

  return { envaseQty, cajaQty };
}

/**
 * Convierte el resultado de computePackaging en OrderItem[] para agregar al carrito.
 * @param result { envaseQty, cajaQty } de computePackaging
 * @returns OrderItem[] con los items de envases y/o cajas
 */
export function createPackagingItems(result: PackagingResult): OrderItem[] {
  const items: OrderItem[] = [];

  if (result.envaseQty > 0) {
    items.push({
      productId: PACKAGING.envase.productId,
      productName: PACKAGING.envase.name,
      quantity: result.envaseQty,
      unitPrice: PACKAGING.envase.price,
      totalPrice: result.envaseQty * PACKAGING.envase.price,
      station: 'KITCHEN',
    });
  }

  if (result.cajaQty > 0) {
    items.push({
      productId: PACKAGING.cajaPizza.productId,
      productName: PACKAGING.cajaPizza.name,
      quantity: result.cajaQty,
      unitPrice: PACKAGING.cajaPizza.price,
      totalPrice: result.cajaQty * PACKAGING.cajaPizza.price,
      station: 'KITCHEN',
    });
  }

  return items;
}
