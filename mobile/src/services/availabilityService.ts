import { api } from './api/apiClient';

export interface Faltante {
  productId: string;
  needed: number;
  available: number;
}

export interface AvailabilityStatus {
  status: 'OK' | 'AVISO' | 'AGOTADO' | 'SIN_LINEA_BASE' | 'SIN_CONTROL';
  faltantes?: Faltante[];
  maxPortions?: number;
}

export type AvailabilityMap = Map<string, AvailabilityStatus>;

// Cache simple: { [station]: { data: AvailabilityMap, timestamp: number } }
const cache: Record<
  string,
  { data: Record<string, AvailabilityStatus>; timestamp: number }
> = {};
const CACHE_TTL_MS = 20 * 1000; // 20 segundos

export const availabilityService = {
  async checkAvailability(station: string): Promise<AvailabilityMap> {
    const now = Date.now();
    const cached = cache[station];

    // Retornar del cache si existe y no expiró
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return new Map(Object.entries(cached.data));
    }

    // Fetch del servidor
    try {
      const data = await api.get<Record<string, AvailabilityStatus>>(
        `/api/inventory/availability?station=${station}`,
      );

      // Guardar en cache
      cache[station] = {
        data,
        timestamp: now,
      };

      return new Map(Object.entries(data || {}));
    } catch (error) {
      // Si falla, intenta devolver del cache aunque haya expirado
      if (cached) {
        return new Map(Object.entries(cached.data));
      }
      // Si no hay cache, devolver mapa vacío (sin errores bloqueantes)
      return new Map();
    }
  },

  // Limpiar cache (útil para testing o refresh forzado)
  clearCache(station?: string): void {
    if (station) {
      delete cache[station];
    } else {
      Object.keys(cache).forEach((k) => delete cache[k]);
    }
  },
};
