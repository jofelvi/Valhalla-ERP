// services/attendanceHelpers.ts
// Principio SRP: Separación de responsabilidades para la gestión de asistencias

import { Attendance } from '@odin6/types';

export interface AttendanceState {
  readonly canCheckIn: boolean;
  readonly canCheckOut: boolean;
  readonly hasActiveCheckIn: boolean;
  readonly lastCheckIn: Date | null;
  readonly lastCheckOut: Date | null;
  readonly isValid: boolean;
}

export class AttendanceStateCalculator {
  // Principio SRP: Una sola responsabilidad - calcular el estado de asistencia
  static calculateState(todayAttendances: Attendance[]): AttendanceState {
    if (!todayAttendances || todayAttendances.length === 0) {
      return {
        canCheckIn: true,
        canCheckOut: false,
        hasActiveCheckIn: false,
        lastCheckIn: null,
        lastCheckOut: null,
        isValid: true,
      };
    }

    // Ordenar por fecha de creación para obtener el más reciente
    const sortedAttendances = [...todayAttendances].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    );

    const latestAttendance = sortedAttendances[0];

    // Verificar consistencia de datos
    const hasValidCheckIn =
      (latestAttendance.checkIn && latestAttendance.checkIn instanceof Date) ||
      typeof latestAttendance.checkIn === 'string';

    const hasValidCheckOut =
      (latestAttendance.checkOut &&
        latestAttendance.checkOut instanceof Date) ||
      typeof latestAttendance.checkOut === 'string';

    return {
      canCheckIn: !hasValidCheckIn || hasValidCheckOut,
      canCheckOut: hasValidCheckIn && !hasValidCheckOut,
      hasActiveCheckIn: hasValidCheckIn && !hasValidCheckOut,
      lastCheckIn: hasValidCheckIn ? new Date(latestAttendance.checkIn!) : null,
      lastCheckOut: hasValidCheckOut
        ? new Date(latestAttendance.checkOut!)
        : null,
      isValid: this.validateAttendanceData(latestAttendance),
    };
  }

  // Principio OCP: Abierto para extensión, cerrado para modificación
  private static validateAttendanceData(attendance: Attendance): boolean {
    // Validar que los datos de Firebase sean consistentes
    if (attendance.checkIn && attendance.checkOut) {
      const checkInTime = new Date(attendance.checkIn);
      const checkOutTime = new Date(attendance.checkOut);

      // CheckOut debe ser después de CheckIn
      if (checkOutTime <= checkInTime) {
        console.warn('Invalid checkout time detected:', {
          checkIn: checkInTime,
          checkOut: checkOutTime,
          attendanceId: attendance.id,
        });
        return false;
      }
    }

    return true;
  }
}

// Hook personalizado para manejar el estado de asistencia
// Principio DIP: Dependemos de abstracciones, no de concreciones
export const useAttendanceState = (
  employeeId: string,
  todayAttendances: Attendance[],
) => {
  const attendanceState =
    AttendanceStateCalculator.calculateState(todayAttendances);

  const debugInfo = {
    totalAttendances: todayAttendances.length,
    attendances: todayAttendances.map((att) => ({
      id: att.id,
      checkIn: att.checkIn,
      checkOut: att.checkOut,
      createdAt: att.createdAt,
      status: att.status,
    })),
    calculatedState: attendanceState,
  };

  // Log para debugging
  console.log('🔍 Attendance Debug Info:', debugInfo);

  return {
    ...attendanceState,
    debugInfo,
  };
};
