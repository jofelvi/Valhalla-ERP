import { OPERACION_DEFAULT } from '@odin6/types';
import {
  AJUSTES_ASISTENCIA_POR_DEFECTO,
  esLlegadaTarde,
  normalizarAjustesAsistencia,
} from './attendance-settings';

// La pantalla de ajustes de asistencia guardaba en el localStorage del
// navegador y el APK traia la geocerca horneada en el build: nada de lo que
// el admin tocaba llegaba a ningun lado. Esto fija como se lee lo guardado.
describe('normalizarAjustesAsistencia', () => {
  it('sin documento devuelve los mismos valores que traia el APK', () => {
    expect(normalizarAjustesAsistencia(null)).toEqual(
      AJUSTES_ASISTENCIA_POR_DEFECTO,
    );
    expect(normalizarAjustesAsistencia(undefined)).toEqual(
      AJUSTES_ASISTENCIA_POR_DEFECTO,
    );
  });

  it('respeta lo guardado cuando es valido', () => {
    const ajustes = normalizarAjustesAsistencia({
      geofence: {
        latitude: 10.5,
        longitude: -66.9,
        radiusMeters: 150,
        locationName: 'Otro',
      },
      standardCheckInHour: 14,
      lateGraceMinutes: 20,
    });
    expect(ajustes).toEqual({
      geofence: {
        latitude: 10.5,
        longitude: -66.9,
        radiusMeters: 150,
        locationName: 'Otro',
      },
      standardCheckInHour: 14,
      lateGraceMinutes: 20,
    });
  });

  it('un campo roto cae a su default sin arrastrar a los demas', () => {
    // Un radio de 0 dejaria a todo el personal sin poder fichar.
    const ajustes = normalizarAjustesAsistencia({
      geofence: {
        latitude: 10.5,
        longitude: 'x',
        radiusMeters: 0,
        locationName: '  ',
      },
      standardCheckInHour: 30,
      lateGraceMinutes: 15,
    });
    expect(ajustes.geofence.latitude).toBe(10.5);
    expect(ajustes.geofence.longitude).toBe(
      AJUSTES_ASISTENCIA_POR_DEFECTO.geofence.longitude,
    );
    expect(ajustes.geofence.radiusMeters).toBe(
      AJUSTES_ASISTENCIA_POR_DEFECTO.geofence.radiusMeters,
    );
    expect(ajustes.geofence.locationName).toBe(
      AJUSTES_ASISTENCIA_POR_DEFECTO.geofence.locationName,
    );
    expect(ajustes.standardCheckInHour).toBe(
      AJUSTES_ASISTENCIA_POR_DEFECTO.standardCheckInHour,
    );
    expect(ajustes.lateGraceMinutes).toBe(15);
  });
});

describe('esLlegadaTarde', () => {
  // Entrada 14:00 Caracas + 30 min de gracia: limite 14:30.
  const ajustes = {
    ...AJUSTES_ASISTENCIA_POR_DEFECTO,
    standardCheckInHour: 14,
    lateGraceMinutes: 30,
  };
  // Caracas = UTC-4, asi que 14:30 Caracas = 18:30Z.
  const a = (isoUtc: string) => new Date(isoUtc);

  it('en punto o dentro de la gracia no es tarde', () => {
    expect(
      esLlegadaTarde(a('2026-09-11T18:00:00Z'), ajustes, OPERACION_DEFAULT),
    ).toBe(false);
    expect(
      esLlegadaTarde(a('2026-09-11T18:30:00Z'), ajustes, OPERACION_DEFAULT),
    ).toBe(false);
  });

  it('un minuto despues de la gracia es tarde', () => {
    expect(
      esLlegadaTarde(a('2026-09-11T18:31:00Z'), ajustes, OPERACION_DEFAULT),
    ).toBe(true);
  });

  it('usa la hora de Caracas, no la del servidor', () => {
    // 22:00Z = 18:00 Caracas: tarde. En Berlin (UTC+2) serian las 00:00,
    // y con el reloj del servidor pareceria "temprano".
    expect(
      esLlegadaTarde(a('2026-09-11T22:00:00Z'), ajustes, OPERACION_DEFAULT),
    ).toBe(true);
  });
});
