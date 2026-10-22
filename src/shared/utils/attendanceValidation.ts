import { Attendance, CreateAttendanceData } from '@odin6/types';
import { AttendanceStatusEnum } from '@/shared/types/enumShared';

export interface AttendanceValidationError {
  field: string;
  message: string;
}

export interface AttendanceValidationResult {
  isValid: boolean;
  errors: AttendanceValidationError[];
  warnings: string[];
}

/**
 * Validates attendance data according to business rules
 */
export class AttendanceValidator {
  private static readonly STANDARD_WORK_HOURS = 8;
  private static readonly MAX_WORK_HOURS = 12;
  private static readonly MIN_BREAK_MINUTES = 30;
  private static readonly MAX_BREAK_MINUTES = 120;

  /**
   * Validate attendance record
   */
  static validateAttendance(
    data: CreateAttendanceData,
  ): AttendanceValidationResult {
    const errors: AttendanceValidationError[] = [];
    const warnings: string[] = [];

    // Basic validations
    this.validateBasicFields(data, errors);

    // Time-based validations (only for present/late/early departure)
    if (this.requiresTimeValidation(data.status)) {
      this.validateTimes(data, errors, warnings);
    }

    // Date validations
    this.validateDate(data, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate multiple attendance records for conflicts
   */
  static validateAttendanceConflicts(
    newAttendance: CreateAttendanceData,
    existingAttendances: Attendance[],
  ): AttendanceValidationResult {
    const errors: AttendanceValidationError[] = [];
    const warnings: string[] = [];

    // Check for duplicate dates
    const sameDate = existingAttendances.find(
      (existing) =>
        new Date(existing.date).toDateString() ===
        new Date(newAttendance.date).toDateString(),
    );

    if (sameDate) {
      errors.push({
        field: 'date',
        message: 'Ya existe un registro de asistencia para esta fecha',
      });
    }

    // Check for overlapping times
    if (newAttendance.checkIn && newAttendance.checkOut) {
      const overlapping = existingAttendances.find((existing) => {
        if (!existing.checkIn || !existing.checkOut) return false;

        const newStart = new Date(newAttendance.checkIn!);
        const newEnd = new Date(newAttendance.checkOut!);
        const existingStart = new Date(existing.checkIn);
        const existingEnd = new Date(existing.checkOut);

        return (
          (newStart >= existingStart && newStart <= existingEnd) ||
          (newEnd >= existingStart && newEnd <= existingEnd) ||
          (newStart <= existingStart && newEnd >= existingEnd)
        );
      });

      if (overlapping) {
        warnings.push(
          'Existe un solapamiento de horarios con otro registro de asistencia',
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Calculate automatic status based on times
   */
  static calculateStatus(
    data: Partial<CreateAttendanceData>,
  ): AttendanceStatusEnum {
    if (!data.checkIn) {
      return <AttendanceStatusEnum>data.status;
    }

    const checkInTime = new Date(data.checkIn);
    const standardStart = new Date(checkInTime);
    standardStart.setHours(9, 0, 0, 0); // 9:00 AM

    // Late if check-in is more than 15 minutes after standard time
    if (checkInTime.getTime() > standardStart.getTime() + 15 * 60 * 1000) {
      return AttendanceStatusEnum.LATE;
    }

    // Early departure if check-out is before standard end time
    if (data.checkOut) {
      const checkOutTime = new Date(data.checkOut);
      const standardEnd = new Date(checkOutTime);
      standardEnd.setHours(18, 0, 0, 0); // 6:00 PM

      if (checkOutTime.getTime() < standardEnd.getTime() - 15 * 60 * 1000) {
        return AttendanceStatusEnum.EARLY_DEPARTURE;
      }
    }

    return AttendanceStatusEnum.PRESENT;
  }

  /**
   * Calculate total hours worked
   */
  static calculateHours(data: CreateAttendanceData): {
    totalHours: number;
    overtimeHours: number;
    breakHours: number;
  } {
    if (!data.checkIn || !data.checkOut) {
      return { totalHours: 0, overtimeHours: 0, breakHours: 0 };
    }

    const checkIn = new Date(data.checkIn);
    const checkOut = new Date(data.checkOut);

    let totalMinutes = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60);

    // Subtract break time
    let breakMinutes = 0;
    if (data.breakStart && data.breakEnd) {
      const breakStart = new Date(data.breakStart);
      const breakEnd = new Date(data.breakEnd);
      breakMinutes = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);
    }

    totalMinutes -= breakMinutes;
    const totalHours = Math.max(0, totalMinutes / 60);
    const overtimeHours = Math.max(0, totalHours - this.STANDARD_WORK_HOURS);

    return {
      totalHours,
      overtimeHours,
      breakHours: breakMinutes / 60,
    };
  }

  private static validateBasicFields(
    data: CreateAttendanceData,
    errors: AttendanceValidationError[],
  ): void {
    if (!data.employeeId) {
      errors.push({
        field: 'employeeId',
        message: 'ID de empleado es requerido',
      });
    }

    if (!data.date) {
      errors.push({
        field: 'date',
        message: 'Fecha es requerida',
      });
    }

    if (!data.status) {
      errors.push({
        field: 'status',
        message: 'Estado es requerido',
      });
    }
  }

  private static validateTimes(
    data: CreateAttendanceData,
    errors: AttendanceValidationError[],
    warnings: string[],
  ): void {
    // Check if check-in is before check-out
    if (data.checkIn && data.checkOut) {
      const checkIn = new Date(data.checkIn);
      const checkOut = new Date(data.checkOut);

      if (checkOut <= checkIn) {
        errors.push({
          field: 'checkOut',
          message: 'La hora de salida debe ser posterior a la hora de entrada',
        });
      }

      // Check for excessive work hours
      const hoursWorked =
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
      if (hoursWorked > this.MAX_WORK_HOURS) {
        warnings.push(
          `Jornada excesivamente larga: ${hoursWorked.toFixed(1)} horas`,
        );
      }
    }

    // Validate break times
    if (data.breakStart && data.breakEnd) {
      const breakStart = new Date(data.breakStart);
      const breakEnd = new Date(data.breakEnd);

      if (breakEnd <= breakStart) {
        errors.push({
          field: 'breakEnd',
          message: 'El fin del descanso debe ser posterior al inicio',
        });
      }

      // Check if break is within work hours
      if (data.checkIn && data.checkOut) {
        const checkIn = new Date(data.checkIn);
        const checkOut = new Date(data.checkOut);

        if (breakStart < checkIn || breakEnd > checkOut) {
          errors.push({
            field: 'breakStart',
            message: 'El descanso debe estar dentro del horario de trabajo',
          });
        }
      }

      // Check break duration
      const breakMinutes =
        (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);
      if (breakMinutes < this.MIN_BREAK_MINUTES) {
        warnings.push(`Descanso muy corto: ${breakMinutes} minutos`);
      }
      if (breakMinutes > this.MAX_BREAK_MINUTES) {
        warnings.push(`Descanso muy largo: ${breakMinutes} minutos`);
      }
    }
  }

  private static validateDate(
    data: CreateAttendanceData,
    errors: AttendanceValidationError[],
    warnings: string[],
  ): void {
    const attendanceDate = new Date(data.date);
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    // Check if date is in the future
    if (attendanceDate > today) {
      errors.push({
        field: 'date',
        message: 'No se puede registrar asistencia para fechas futuras',
      });
    }

    // Check if date is too old
    if (attendanceDate < oneYearAgo) {
      warnings.push('La fecha es muy antigua (más de un año)');
    }

    // Check if it's a weekend for standard work schedules
    const dayOfWeek = attendanceDate.getDay();
    if (
      (dayOfWeek === 0 || dayOfWeek === 6) &&
      data.status === AttendanceStatusEnum.PRESENT
    ) {
      warnings.push('Registrando asistencia en fin de semana');
    }
  }

  private static requiresTimeValidation(status: AttendanceStatusEnum): boolean {
    return [
      AttendanceStatusEnum.PRESENT,
      AttendanceStatusEnum.LATE,
      AttendanceStatusEnum.EARLY_DEPARTURE,
    ].includes(status);
  }
}

/**
 * Business rules for attendance management
 */
export class AttendanceBusinessRules {
  /**
   * Check if an employee can check in
   */
  static canCheckIn(
    employeeId: string,
    existingAttendances: Attendance[],
  ): {
    canCheckIn: boolean;
    reason?: string;
  } {
    const today = new Date();
    const todayAttendance = existingAttendances.find(
      (att) => new Date(att.date).toDateString() === today.toDateString(),
    );

    if (todayAttendance) {
      return {
        canCheckIn: false,
        reason: 'Ya existe un registro de entrada para hoy',
      };
    }

    return { canCheckIn: true };
  }

  /**
   * Check if an employee can check out
   */
  static canCheckOut(
    employeeId: string,
    existingAttendances: Attendance[],
  ): {
    canCheckOut: boolean;
    reason?: string;
    attendanceId?: string;
  } {
    const today = new Date();
    const todayAttendance = existingAttendances.find(
      (att) => new Date(att.date).toDateString() === today.toDateString(),
    );

    if (!todayAttendance) {
      return {
        canCheckOut: false,
        reason: 'No hay registro de entrada para hoy',
      };
    }

    if (todayAttendance.checkOut) {
      return {
        canCheckOut: false,
        reason: 'Ya se registró la salida para hoy',
      };
    }

    return {
      canCheckOut: true,
      attendanceId: todayAttendance.id,
    };
  }

  /**
   * Get attendance requirements for an employee
   */
  static getAttendanceRequirements(employeeRole: string): {
    requiredHours: number;
    flexibleSchedule: boolean;
    canWorkRemote: boolean;
    overtimeAllowed: boolean;
  } {
    // Different rules based on employee role
    switch (employeeRole.toLowerCase()) {
      case 'manager':
      case 'admin':
        return {
          requiredHours: 8,
          flexibleSchedule: true,
          canWorkRemote: true,
          overtimeAllowed: true,
        };
      case 'cashier':
      case 'waiter':
        return {
          requiredHours: 8,
          flexibleSchedule: false,
          canWorkRemote: false,
          overtimeAllowed: true,
        };
      case 'kitchen':
        return {
          requiredHours: 8,
          flexibleSchedule: false,
          canWorkRemote: false,
          overtimeAllowed: true,
        };
      default:
        return {
          requiredHours: 8,
          flexibleSchedule: false,
          canWorkRemote: false,
          overtimeAllowed: false,
        };
    }
  }
}
