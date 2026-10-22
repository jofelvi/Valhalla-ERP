/**
 * Preservación de ESTADO por item cuando el cliente reescribe el array completo
 * de items en un PATCH.
 *
 * El POS/APK reenvía todos los items en cada edición; Mongoose les asigna _ids
 * NUEVOS. Sin heredar el estado del item previo (match por `productId`) se pierden
 * campos que el cliente no reenvía, y eso rompió cosas reales:
 *  - `printedQty`/`sentQty` faltantes → reimpresión fantasma de comandas.
 *  - `inventoryConsumedQty` faltante → el PAGO vuelve a descontar el consumo que ya
 *    se hizo en la ENTREGA (ficha/estación) → DOBLE descuento de stock (packs/Pilsen
 *    caían a negativo). Confirmado 11/08 con la orden 6a78d505.
 */
export const ITEM_STATE_FIELDS = [
  'sentQty',
  'deliveredQty',
  'inventoryConsumedQty',
  'printedQty',
  'printAttempts',
  'addedAt',
  'quantityLog',
  'noCharge',
  'noChargeAt',
  'noChargeBy',
  'noChargeReason',
  'noChargePinValidatedByUserId',
  'noChargeDeliveredQtyAtTime',
  // Quien causo el error que motivo la cortesia (COCINA/BARRA/MESONERO/CASA).
  'noChargeResponsible',
  // Descuento parcial autorizado con PIN admin. Sin heredarlo, el PATCH del
  // APK devolvia la linea a precio pleno y el descuento se perdia en silencio.
  'discountType',
  'discountValue',
  'discountAmount',
  'discountReason',
  'discountAt',
  'discountBy',
  'discountPinValidatedByUserId',
  'cancelledAt',
  'cancelledBy',
  'cancelReason',
  'customizations',
] as const;

/**
 * Rellena en cada item entrante los `ITEM_STATE_FIELDS` que vengan AUSENTES,
 * tomándolos del item previo con el mismo `productId` (consume duplicados en
 * orden, para que N items iguales hereden de N previos distintos). Pura.
 */
export function inheritItemState(
  incoming: Array<Record<string, unknown>>,
  previous: Array<Record<string, unknown>> | undefined | null,
): Array<Record<string, unknown>> {
  if (!previous?.length) return incoming;
  const pool = [...previous];
  return incoming.map((item) => {
    const idx = pool.findIndex((p) => p.productId === item.productId);
    if (idx === -1) return item;
    const [prev] = pool.splice(idx, 1);
    const merged: Record<string, unknown> = { ...item };
    for (const f of ITEM_STATE_FIELDS) {
      if (merged[f] === undefined && prev[f] !== undefined) {
        merged[f] = prev[f];
      }
    }
    return merged;
  });
}

/**
 * Entregas que ocurrieron EN ESTE PATCH, por item.
 *
 * Por que hace falta: el consumo de inventario en vivo solo se dispara en
 * `deliverItem` / `deliverStation` / `deliverByFicha`. El POS web no usa esas
 * rutas: marca la entrega reescribiendo el array de items con un
 * `PATCH /api/orders/:id`, asi que su stock no se movia hasta que la orden se
 * PAGABA (verificado 03/09/2026 con la orden 030926-0006: entregado=1,
 * inventoryConsumedQty=0, cero movimientos). El inventario terminaba cuadrando,
 * pero no en vivo — que es justo lo que se pide de la barra.
 *
 * Se devuelve el DELTA de esta peticion (nuevo − previo), no el acumulado, para
 * no consumir de golpe el historico de una orden vieja que se edite despues del
 * despliegue.
 *
 * El emparejamiento previo↔nuevo es por `productId` consumiendo duplicados en
 * orden, igual que `inheritItemState`, porque Mongoose reasigna `_id` nuevos en
 * cada reescritura del array.
 */
export function deliveryDeltas(
  previous: Array<Record<string, unknown>> | undefined | null,
  next: Array<Record<string, unknown>>,
): Array<{ item: Record<string, unknown>; delta: number }> {
  const pool = [...(previous ?? [])];
  const moves: Array<{ item: Record<string, unknown>; delta: number }> = [];
  for (const item of next) {
    const idx = pool.findIndex((p) => p.productId === item.productId);
    let antes = 0;
    if (idx !== -1) {
      const [prev] = pool.splice(idx, 1);
      antes = Number(prev.deliveredQty ?? 0) || 0;
    }
    const ahora = Number(item.deliveredQty ?? 0) || 0;
    const delta = ahora - antes;
    if (delta !== 0) moves.push({ item, delta });
  }
  return moves;
}
