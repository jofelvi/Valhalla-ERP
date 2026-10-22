export interface CustomerRequestEntry {
  id: string;
  type: 'PRODUCT' | 'CALL_WAITER' | 'MISC';
  productId?: string;
  productName?: string;
  quantity?: number;
  note?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'ACK';
  createdByCustomerId: string;
  createdAt: Date;
  resolvedByUserId?: string;
  resolvedAt?: Date;
  rejectReason?: string;
}

/**
 * Validacion de una solicitud de producto del cliente. Pura (sin Mongo) para
 * poder probar los limites. El precio NUNCA viene del cliente: se relee del
 * producto en el servicio; aqui solo se validan disponibilidad y cantidad.
 */
export function validateProductRequest(
  input: { quantity: number },
  product: { isForSale?: boolean } | null,
): { ok: true } | { ok: false; reason: string } {
  if (!product || product.isForSale === false) {
    return { ok: false, reason: 'Producto no disponible' };
  }
  const q = Math.floor(input.quantity);
  if (!Number.isFinite(q) || q < 1 || q > 20) {
    return { ok: false, reason: 'Cantidad invalida (1-20)' };
  }
  return { ok: true };
}
