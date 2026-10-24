/**
 * Un pedido cuenta como "ya cobrado" (para la comanda y para cocina, barra y pizza) cuando dejo de
 * estar pendiente de pago: el mesonero ya lo marco pagado, aunque caja lo verifique despues.
 */
export function pedidoCobrado(paymentStatus?: string | null): boolean {
  const s = (paymentStatus ?? '').toLowerCase();
  return s !== '' && s !== 'pending' && s !== 'cancelled';
}

/** Campos del pedido que deciden su visibilidad. Sin Order completo, para probar la regla sola. */
export interface EstadoDeCobro {
  paymentStatus?: string | null;
  paymentRejected?: boolean | null;
  status?: string | null;
}

/**
 * La comanda ya salio de la impresora: el mesonero cobro (pedidoCobrado) o caja rechazo ese cobro.
 * Un rechazo deja paymentStatus en 'pending', pero la comanda ya estaba en cocina y no se
 * vuelve a imprimir. Es la misma regla que `primerCobro` en WaiterPaymentScreen.
 */
export function comandaYaSalio(pedido: EstadoDeCobro): boolean {
  return pedido.paymentRejected === true || pedidoCobrado(pedido.paymentStatus);
}

/**
 * Cocina, barra y pizza (con COMANDA_AL_PAGAR) solo ven pedidos cuya comanda ya salio.
 * Tras un rechazo sigue visible: su comanda ya estaba en la estacion.
 */
export function visibleParaEstaciones(
  pedido: EstadoDeCobro,
  comandaAlPagar: boolean,
): boolean {
  return !comandaAlPagar || comandaYaSalio(pedido);
}

/**
 * Pantallas de caja que listan pedidos de mesoneros (con COMANDA_AL_PAGAR): solo lo cobrado
 * (pending_verification, partial, paid). Un rechazo se oculta: vuelve al mesonero para recobrar.
 * Las cuentas a credito (status CREDIT) siguen visibles, porque caja las cobra despues aunque su
 * paymentStatus sea 'pending'. Sin COMANDA_AL_PAGAR, caja ve todo como antes.
 */
export function visibleParaCaja(
  pedido: EstadoDeCobro,
  comandaAlPagar: boolean,
): boolean {
  if (!comandaAlPagar) return true;
  if (pedido.paymentRejected === true) return false;
  if ((pedido.status ?? '').toUpperCase() === 'CREDIT') return true;
  return pedidoCobrado(pedido.paymentStatus);
}
