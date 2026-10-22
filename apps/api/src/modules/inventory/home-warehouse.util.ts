import { InventoryArea } from './units';

export type HomeArea = Extract<InventoryArea, 'BARRA' | 'COCINA'>;

/**
 * Área "casa" de un producto: el único lugar donde vive su stock.
 *
 * Antes cada escritura elegía almacén a su manera: las compras del APK caían en
 * el Depósito, la venta descontaba del almacén de la estación del PLATO (la
 * leche de un trago salía de la Barra) y el tobo solo miraba la Barra. Con 36
 * Pilsen contadas en el Depósito, el tobo de latas decía "Sin stock"
 * (11/09/2026). Ahora cada producto tiene una sola casa, la de su estación.
 *
 * Sin estación devuelve null: no se adivina, se respeta el almacén pedido.
 * La pizza vive en Cocina (la Pizzería no tiene stock propio).
 */
export const homeAreaOf = (product: {
  station?: string | null;
}): HomeArea | null => {
  switch (product.station) {
    case 'BAR':
      return 'BARRA';
    case 'KITCHEN':
    case 'PIZZA':
      return 'COCINA';
    default:
      return null;
  }
};
