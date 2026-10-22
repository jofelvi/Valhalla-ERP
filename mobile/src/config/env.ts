/**
 * Variables que fija cada build (perfil de EAS en `eas.json`, o `.env` en desarrollo).
 * Nada de esto es de un negocio concreto: los valores por defecto son de plantilla.
 */
const DEFAULT_API_URL = 'https://api.example.com';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;
export const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? API_URL;

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Geocerca de RESPALDO del build. La manda el servidor (`/api/attendance/settings`) y
 * solo se usa si ese dato no llega. Sin variables queda en cero: radio 0 es inválido, así
 * que el fichaje se niega (falla cerrada) en vez de aceptar un punto de otro negocio.
 */
export const GEOFENCE = {
  latitude: parseNumber(process.env.EXPO_PUBLIC_GEOFENCE_LAT, 0),
  longitude: parseNumber(process.env.EXPO_PUBLIC_GEOFENCE_LNG, 0),
  radiusMeters: parseNumber(process.env.EXPO_PUBLIC_GEOFENCE_RADIUS_M, 0),
};
