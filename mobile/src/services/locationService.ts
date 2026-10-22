import * as Location from 'expo-location';
import { GEOFENCE } from '../config/env';
import { GpsCoordinates } from '../types';
import { api } from './api/apiClient';
import { Geocerca, geocercaDesdeRespuesta } from './geocerca';

// La geocerca la manda el servidor ("Configuracion -> Asistencia" en la web).
// Se guarda 5 minutos: se consulta al abrir la pantalla de asistencia, no en
// cada lectura del GPS.
const TTL_GEOCERCA_MS = 5 * 60_000;
let geocercaCacheada: { valor: Geocerca; expira: number } | null = null;

const geocercaVigente = async (): Promise<Geocerca> => {
  if (geocercaCacheada && Date.now() < geocercaCacheada.expira) {
    return geocercaCacheada.valor;
  }
  try {
    const respuesta = await api.get<
      Parameters<typeof geocercaDesdeRespuesta>[0]
    >('/api/attendance/settings');
    const valor = geocercaDesdeRespuesta(respuesta, GEOFENCE);
    geocercaCacheada = { valor, expira: Date.now() + TTL_GEOCERCA_MS };
    return valor;
  } catch {
    // Sin red o API vieja: la ultima conocida, o la del build. No se cachea
    // el fallo para volver a intentar en la proxima lectura.
    return geocercaCacheada?.valor ?? GEOFENCE;
  }
};

// Radio de la Tierra en metros
const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Calcula la distancia entre dos puntos GPS usando la formula de Haversine.
 * Retorna la distancia en metros.
 */
const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
};

export const locationService = {
  /**
   * Solicita permisos de ubicacion al usuario.
   */
  async requestPermissions(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  },

  /**
   * Obtiene la ubicacion actual con alta precision.
   */
  async getCurrentLocation(): Promise<GpsCoordinates> {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? 0,
    };
  },

  /**
   * Verifica si las coordenadas estan dentro del geofence del club.
   */
  async isWithinGeofence(coords: GpsCoordinates): Promise<boolean> {
    const geocerca = await geocercaVigente();
    const distance = haversineDistance(
      coords.latitude,
      coords.longitude,
      geocerca.latitude,
      geocerca.longitude,
    );
    return distance <= geocerca.radiusMeters;
  },

  /**
   * Retorna la distancia en metros desde el centro del club.
   */
  async getDistanceFromClub(coords: GpsCoordinates): Promise<number> {
    const geocerca = await geocercaVigente();
    return haversineDistance(
      coords.latitude,
      coords.longitude,
      geocerca.latitude,
      geocerca.longitude,
    );
  },

  /** Obliga a releer la geocerca del servidor en la proxima consulta. */
  invalidateGeofenceCache(): void {
    geocercaCacheada = null;
  },
};
