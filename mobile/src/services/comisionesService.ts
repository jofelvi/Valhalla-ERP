import { api } from './api/apiClient';

/** Respuesta de GET /api/comisiones/calcular */
export interface ComisionResumen {
  waiterId: string;
  totalAmount: number;
  totalTip: number;
  paymentCount: number;
}

/** Registro de liquidación de comisión (GET historial / :id) */
export interface PagoComision {
  id: string;
  waiterId: string;
  waiterName: string;
  orderIds: string[];
  montoTotal: number;
  tipTotal?: number;
  sesionesCubiertas?: number;
  periodoDesde: string;
  periodoHasta: string;
  fechaPago: string;
  usuarioPago: string;
  notas?: string;
  comisionPct?: number;
}

export const comisionesService = {
  getResumen(waiterId: string): Promise<ComisionResumen> {
    return api.get<ComisionResumen>('/api/comisiones/calcular', { waiterId });
  },

  getHistorial(waiterId: string): Promise<PagoComision[]> {
    return api.get<PagoComision[]>('/api/comisiones/historial', { waiterId });
  },

  getPagoById(id: string): Promise<PagoComision> {
    return api.get<PagoComision>(`/api/comisiones/${encodeURIComponent(id)}`);
  },
};
