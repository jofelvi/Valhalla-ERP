/**
 * Un pedido cuenta como "ya cobrado" (para la comanda y para cocina, barra y pizza) cuando dejo de
 * estar pendiente de pago: el mesonero ya lo marco pagado, aunque caja lo verifique despues.
 */
export function pedidoCobrado(paymentStatus?: string | null): boolean {
  const s = (paymentStatus ?? '').toLowerCase();
  return s !== '' && s !== 'pending' && s !== 'cancelled';
}
