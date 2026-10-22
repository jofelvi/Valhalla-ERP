import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';

/** Nivel de alerta según el margen de ganancia */
export type MarginLevel = 'NEGATIVO' | 'NULO' | 'BAJO';

/** Una alerta de margen en riesgo de un producto */
export interface MarginAlert {
  productId: string;
  name: string;
  price: number;
  cost: number;
  marginPct: number;
  nivel: MarginLevel;
  insumoName?: string;
  causa?: string;
}

/** Producto con naturaleza pendiente de definir */
export interface PendingNaturaleza {
  productId: string;
  name: string;
}

/** Producto sin stock en ningún almacén */
export interface OutOfStockProduct {
  productId: string;
  name: string;
}

/** Respuesta completa del endpoint GET /api/alerts/panel */
export interface AlertsPanelResponse {
  margenes: MarginAlert[];
  pendientes: PendingNaturaleza[];
  agotados: OutOfStockProduct[];
}

export const alertsKeys = {
  all: ['alerts'] as const,
  panel: () => [...alertsKeys.all, 'panel'] as const,
};

/**
 * Hook para obtener alertas del panel de administración.
 *
 * Recupera:
 * - Márgenes en riesgo (NEGATIVO/NULO/BAJO)
 * - Productos con naturaleza pendiente
 * - Productos agotados
 *
 * El endpoint es GET /api/alerts/panel (no el viejo /api/alerts).
 */
export function useAlertsPanel() {
  return useQuery({
    queryKey: alertsKeys.panel(),
    queryFn: () => api.get<AlertsPanelResponse>('/api/alerts/panel'),
    staleTime: 60_000, // 1 minuto
  });
}
