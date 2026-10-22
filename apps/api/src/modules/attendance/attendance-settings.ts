/**
 * Ajustes de asistencia: geocerca del local y hora de entrada.
 *
 * El valor vive en Mongo (`configs/attendance`) y lo leen todos. Aquí va solo la parte pura
 * (normalizar y decidir "tarde"), sin Nest ni Mongoose, para poder probarla sin base.
 */
import { OperacionConfig } from '@odin6/types';
import { paredEnZona } from '../../common/operacion/operacion.util';

export const ID_CONFIG_ASISTENCIA = 'attendance';

export interface GeocercaAsistencia {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  locationName: string;
}

export interface AjustesAsistencia {
  geofence: GeocercaAsistencia;
  /** Hora de entrada esperada, 0-23, en la zona de la operación. */
  standardCheckInHour: number;
  /** Minutos despues de la hora de entrada antes de contar como tarde. */
  lateGraceMinutes: number;
}

/**
 * Instalación neutra: sin geocerca (nombre vacío) hasta que el negocio la configure. Las
 * coordenadas en cero no son un lugar real; el cliente debe tratar un `locationName` vacío
 * como "sin geocerca".
 */
export const AJUSTES_ASISTENCIA_POR_DEFECTO: AjustesAsistencia = {
  geofence: {
    latitude: 0,
    longitude: 0,
    radiusMeters: 200,
    locationName: '',
  },
  standardCheckInHour: 9,
  lateGraceMinutes: 60,
};

const numeroEnRango = (
  valor: unknown,
  min: number,
  max: number,
  porDefecto: number,
): number =>
  typeof valor === 'number' &&
  Number.isFinite(valor) &&
  valor >= min &&
  valor <= max
    ? valor
    : porDefecto;

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null;

/**
 * Lee lo que haya en Mongo campo por campo: un valor roto o fuera de rango
 * cae a su default en vez de tumbar la geocerca entera (un radio de 0 dejaria
 * a todo el personal sin poder fichar).
 */
export function normalizarAjustesAsistencia(doc: unknown): AjustesAsistencia {
  const base = AJUSTES_ASISTENCIA_POR_DEFECTO;
  const d = esObjeto(doc) ? doc : {};
  const g = esObjeto(d.geofence) ? d.geofence : {};

  return {
    geofence: {
      latitude: numeroEnRango(g.latitude, -90, 90, base.geofence.latitude),
      longitude: numeroEnRango(g.longitude, -180, 180, base.geofence.longitude),
      radiusMeters: numeroEnRango(
        g.radiusMeters,
        10,
        5000,
        base.geofence.radiusMeters,
      ),
      locationName:
        typeof g.locationName === 'string' && g.locationName.trim()
          ? g.locationName.trim()
          : base.geofence.locationName,
    },
    standardCheckInHour: Math.trunc(
      numeroEnRango(d.standardCheckInHour, 0, 23, base.standardCheckInHour),
    ),
    lateGraceMinutes: Math.trunc(
      numeroEnRango(d.lateGraceMinutes, 0, 180, base.lateGraceMinutes),
    ),
  };
}

/**
 * true si la entrada cae despues de `hora de entrada + gracia`, en la zona de la operación
 * (el servidor puede correr en otra zona: su reloj local no sirve).
 */
export function esLlegadaTarde(
  checkIn: Date,
  ajustes: AjustesAsistencia,
  op: OperacionConfig,
): boolean {
  const pared = paredEnZona(checkIn, op.timezone);
  const minutoDelDia = pared.hora * 60 + pared.minuto;
  const limite = ajustes.standardCheckInHour * 60 + ajustes.lateGraceMinutes;
  return minutoDelDia > limite;
}
