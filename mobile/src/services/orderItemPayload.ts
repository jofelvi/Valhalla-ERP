import type { OrderItem } from '../types/models';

/**
 * Forma en que un item viaja en `PATCH /api/orders/:id`.
 *
 * El DTO de la API exige `total` (y lee `name`), pero el modelo del APK solo
 * tiene `totalPrice`/`productName`. Mandar `order.items` tal cual daba un 400
 * ("items.0.total should not be empty") y el detalle del pedido lo mostraba
 * como "No se pudo autorizar": quitar un producto comandado era imposible aun
 * con el PIN correcto (visto en produccion el 02/06, 18/07, 09/08 y 18/08).
 *
 * Lo que el servidor conserva solo (descuentos, cortesias, consumo de
 * inventario) lo hereda por `productId` cuando la clave NO viene, asi que aqui
 * no se manda ninguna clave de estado con valor vacio: un `cancelledAt: null`
 * explicito borraria la anulacion previa de la linea.
 */
export const toApiOrderItem = (item: OrderItem): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    productId: item.productId,
    productName: item.productName || item.name,
    name: item.name || item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    price: item.unitPrice,
    totalPrice: item.totalPrice ?? item.total,
    total: item.total ?? item.totalPrice,
    notes: item.notes ?? null,
    deliveredQty: item.deliveredQty ?? 0,
    station: item.station ?? null,
  };
  // Sin sentQty se borraba la marca de impresion y la web veia todo
  // "pendiente por imprimir" (bug 18/07).
  if (item.sentQty !== undefined) payload.sentQty = item.sentQty;
  if (item.presentationQty) payload.presentationQty = item.presentationQty;
  if (item.inventoryConsumedQty !== undefined)
    payload.inventoryConsumedQty = item.inventoryConsumedQty;
  if (item.customizations) payload.customizations = item.customizations;
  if (item.addedAt) payload.addedAt = item.addedAt;
  if (item.cancelledAt) payload.cancelledAt = item.cancelledAt;
  return payload;
};
