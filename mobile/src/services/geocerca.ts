/**
 * Geocerca del club que manda el servidor (`GET /api/attendance/settings`).
 *
 * Antes la app solo conocia la que traia horneada en el build
 * (`EXPO_PUBLIC_GEOFENCE_*`): lo que el admin cambiaba en "Configuracion ->
 * Asistencia" no llegaba a ningun telefono. Aqui se valida lo que llega y, si
 * no sirve, se usa la del build: un radio de 0 o un NaN dejaria a todo el
 * personal sin poder fichar.
 */

export interface Geocerca {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

interface RespuestaAjustes {
  geofence?: Partial<Record<keyof Geocerca, unknown>>;
}

const esNumero = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isFinite(valor);

export const geocercaDesdeRespuesta = (
  respuesta: RespuestaAjustes | null | undefined,
  respaldo: Geocerca,
): Geocerca => {
  const g = respuesta?.geofence;
  if (!g) return respaldo;
  const { latitude, longitude, radiusMeters } = g;
  const valida =
    esNumero(latitude) &&
    esNumero(longitude) &&
    esNumero(radiusMeters) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    radiusMeters > 0;
  return valida ? { latitude, longitude, radiusMeters } : respaldo;
};
