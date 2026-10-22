import { api } from './api/apiClient';
import { Attendance, AttendanceStatusEnum, GpsCoordinates } from '../types';
import { AppState } from 'react-native';
import { encuestarEnPrimerPlano } from './encuestaEnPrimerPlano';

/**
 * Fichar entrada y salida son dos eventos por persona y por dia, y los dispara
 * el propio telefono que esta mirando. 30 s sobra: lo que importa es que al
 * volver a la pantalla se vea al instante, y de eso se encarga la encuesta.
 */
const CADA_MS_DE_LA_ASISTENCIA = 30_000;

// --- Tipos ---

export type Unsubscribe = () => void;

interface RawAttendance {
  id?: string;
  _id?: string;
  employeeId: string;
  userId?: string;
  date: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  totalHours?: number;
  overtimeHours?: number;
  hoursWorked?: number;
  status: string;
  notes?: string;
  photoUrl?: string;
  checkOutPhotoUrl?: string;
  location?: {
    checkIn?: GpsCoordinates | null;
    checkOut?: GpsCoordinates | null;
  };
  createdAt?: string | null;
  updatedAt?: string | null;
}

// --- Parsers ---

function parseDate(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseAttendance(raw: RawAttendance): Attendance {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    employeeId: raw.employeeId,
    userId: raw.userId,
    date: parseDate(raw.date) ?? new Date(),
    checkIn: parseDate(raw.checkIn),
    checkOut: parseDate(raw.checkOut),
    totalHours: raw.totalHours ?? 0,
    overtimeHours: raw.overtimeHours ?? 0,
    hoursWorked: raw.hoursWorked,
    status:
      (raw.status as AttendanceStatusEnum) ?? AttendanceStatusEnum.PRESENT,
    notes: raw.notes,
    photoUrl: raw.photoUrl,
    checkOutPhotoUrl: raw.checkOutPhotoUrl,
    location: raw.location,
    createdAt: parseDate(raw.createdAt) ?? new Date(),
    updatedAt: parseDate(raw.updatedAt) ?? new Date(),
  };
}

// --- Helpers ---

function todayIsoDate(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function readFileAsBase64(uri: string): Promise<string> {
  // XMLHttpRequest para compatibilidad con APK de produccion (file:// URIs)
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('No se pudo leer la imagen local'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Lectura base64 fallida'));
        return;
      }
      // result es un data URL: "data:image/jpeg;base64,....."
      const idx = result.indexOf('base64,');
      resolve(idx >= 0 ? result.slice(idx + 'base64,'.length) : result);
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

// --- Servicio ---

export const attendanceService = {
  /**
   * Sube una selfie al backend (base64). Retorna la URL publica.
   */
  async uploadSelfie(localUri: string, employeeId: string): Promise<string> {
    const base64 = await readFileAsBase64(localUri);
    const extension = (localUri.split('.').pop()?.toLowerCase() ?? 'jpg') as
      | 'jpg'
      | 'jpeg'
      | 'png'
      | 'webp';
    const res = await api.post<{ url: string }>(
      '/api/attendance/upload-selfie',
      {
        employeeId,
        imageBase64: base64,
        extension: ['jpg', 'jpeg', 'png', 'webp'].includes(extension)
          ? extension
          : 'jpg',
      },
    );
    return res.url;
  },

  /**
   * Obtiene el registro de asistencia de hoy para un empleado.
   */
  async getTodayAttendance(employeeId: string): Promise<Attendance | null> {
    const records = await api.get<RawAttendance[]>('/api/attendance', {
      employeeId,
      date: todayIsoDate(),
    });
    if (!records || records.length === 0) return null;
    return parseAttendance(records[0]);
  },

  /**
   * Registra entrada (check-in). El backend usa su hora de servidor.
   */
  async checkIn(
    employeeId: string,
    photoUrl: string,
    coords: GpsCoordinates,
  ): Promise<string> {
    const raw = await api.post<RawAttendance>('/api/attendance/checkin', {
      employeeId,
      userId: employeeId,
      photoUrl,
      location: {
        checkIn: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        },
      },
    });
    return String(raw.id ?? raw._id ?? '');
  },

  /**
   * Registra salida (check-out). El primer argumento es el employeeId.
   * (Antes era attendanceId; ahora el backend resuelve el registro de hoy.)
   */
  async checkOut(
    employeeId: string,
    photoUrl: string,
    coords: GpsCoordinates,
  ): Promise<void> {
    await api.post('/api/attendance/checkout', {
      employeeId,
      photoUrl,
      location: {
        checkOut: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        },
      },
    });
  },

  /**
   * Obtiene mesoneros con check-in hoy sin check-out (activos).
   */
  async getActiveWaitersToday(): Promise<string[]> {
    const records = await api.get<RawAttendance[]>('/api/attendance', {
      date: todayIsoDate(),
    });
    return records
      .filter((r) => r.checkIn && !r.checkOut)
      .map((r) => r.employeeId);
  },

  /**
   * "Suscripcion" en tiempo real a la asistencia de hoy (polling 10s).
   */
  subscribeToTodayAttendance(
    employeeId: string,
    callback: (attendance: Attendance | null) => void,
  ): Unsubscribe {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const att = await this.getTodayAttendance(employeeId);
        if (!cancelled) callback(att);
      } catch (error) {
        if (!cancelled) {
          console.error('Error en listener de asistencia:', error);
          callback(null);
        }
      }
    };

    // Se duerme cuando el telefono no esta en pantalla. Ver
    // `encuestaEnPrimerPlano.ts`: antes esto corria igual en el bolsillo.
    const parar = encuestarEnPrimerPlano(tick, {
      cadaMs: CADA_MS_DE_LA_ASISTENCIA,
      appState: AppState,
    });

    return () => {
      cancelled = true;
      parar();
    };
  },
};
