import { api } from './api/apiClient';

export interface FichaVariantView {
  variantProductId: string;
  variantName: string;
  qty: number;
  deliveredQty: number;
  pendingQty: number;
}

export interface FichaItemView {
  itemId: string;
  productId: string;
  productName: string;
  station: string;
  quantity: number;
  deliveredQty: number;
  pendingQty: number;
  composition?: FichaVariantView[];
}

export interface FichaView {
  orderId: string;
  orderNumber: string;
  tableName?: string | null;
  sector?: string | null;
  waiterName?: string | null;
  createdAt?: string | null;
  status: string;
  fichaToken: string;
  items: FichaItemView[];
}

export interface FichaDelivery {
  itemId: string;
  delta: number;
  // Tobos mixtos: entrega/devolución contra esta variante.
  variantProductId?: string;
}

export interface FichaDeliveryPayload {
  deliveries: FichaDelivery[];
  station?: string;
  // Id de idempotencia: evita doble-descuento en reintentos por mala red.
  opId?: string;
}

export interface FichaReturnPayload {
  // El endpoint /return espera `returns`, NO `deliveries` (FichaReturnDto).
  returns: FichaDelivery[];
  station?: string;
  opId?: string;
}

export const fichaService = {
  // Ficha por id de orden (para mostrar el QR en la app). Genera el nonce si falta.
  async getByOrderId(orderId: string): Promise<FichaView> {
    return api.get<FichaView>(`/api/orders/${orderId}/ficha`);
  },

  // Ficha por token escaneado en la barra.
  async getByToken(token: string): Promise<FichaView> {
    return api.get<FichaView>(`/api/orders/ficha/${encodeURIComponent(token)}`);
  },

  async deliver(
    token: string,
    deliveries: FichaDelivery[],
    station?: string,
    opId?: string,
  ): Promise<FichaView> {
    const payload: FichaDeliveryPayload = { deliveries, station };
    if (opId) {
      payload.opId = opId;
    }
    return api.post<FichaView>(
      `/api/orders/ficha/${encodeURIComponent(token)}/deliver`,
      payload,
    );
  },

  async returnUnits(
    token: string,
    returns: FichaDelivery[],
    station?: string,
    opId?: string,
  ): Promise<FichaView> {
    const payload: FichaReturnPayload = { returns, station };
    if (opId) {
      payload.opId = opId;
    }
    return api.post<FichaView>(
      `/api/orders/ficha/${encodeURIComponent(token)}/return`,
      payload,
    );
  },

  async regenerate(
    orderId: string,
    adminPin: string,
  ): Promise<{ fichaToken: string }> {
    return api.post<{ fichaToken: string }>(
      `/api/orders/${orderId}/ficha/regenerate`,
      { adminPin },
    );
  },
};
