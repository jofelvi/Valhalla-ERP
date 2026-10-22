import {
  Attendance,
  AttendanceReport,
  AttendanceSettings,
  AttendanceSummary,
  DailyAttendance,
} from '@odin6/types';
import { Employee } from '@odin6/types';
import { api } from '@/services/api/apiClient';

// API-based service wrappers
const _attendanceService = {
  getAll: () => api.get<Attendance[]>('/api/attendance'),
};
const employeeService = {
  getById: (id: string) => api.get<Employee>(`/api/employees/${id}`),
  getAll: () => api.get<Employee[]>('/api/employees'),
};
const getEmployeeAttendanceByPeriod = (empId: string, start: Date, end: Date) =>
  api.get<Attendance[]>('/api/attendance', {
    employeeId: empId,
    from: start.toISOString(),
    to: end.toISOString(),
  });
import { AttendanceStatusEnum } from '@/shared';

// Default attendance settings
const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  workingDays: [1, 2, 3, 4, 5], // Monday to Friday
  standardWorkHours: 8,
  overtimeThreshold: 8,
  lateThresholdMinutes: 15,
  earlyDepartureThresholdMinutes: 15,
  standardCheckIn: '09:00',
  standardCheckOut: '18:00',
  breakDurationMinutes: 60,
};

interface AttendanceCleanupResult {
  isValid: boolean;
  issues: string[];
  shouldRemove: boolean;
}

export class AttendanceReportService {
  private settings: AttendanceSettings;

  constructor(settings?: Partial<AttendanceSettings>) {
    this.settings = { ...DEFAULT_ATTENDANCE_SETTINGS, ...settings };
  }

  /**
   * Generate attendance summary for an employee for a specific month
   */
  async generateEmployeeAttendanceSummary(
    employeeId: string,
    month: number,
    year: number,
  ): Promise<AttendanceSummary | null> {
    try {
      const employee = await employeeService.getById(employeeId);
      if (!employee) return null;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const attendances = await getEmployeeAttendanceByPeriod(
        employeeId,
        startDate,
        endDate,
      );

      const workingDays = this.getWorkingDaysInMonth(month, year);
      const summary = this.calculateAttendanceSummary(
        employee,
        attendances,
        workingDays,
        month,
        year,
      );

      return summary;
    } catch (error) {
      console.error('Error generating attendance summary:', error);
      throw error;
    }
  }

  /**
   * Generate attendance report for multiple employees
   */
  async generateAttendanceReport(
    employeeIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<AttendanceReport[]> {
    try {
      const reports: AttendanceReport[] = [];

      for (const employeeId of employeeIds) {
        const employee = await employeeService.getById(employeeId);
        if (!employee) continue;

        const attendances = await getEmployeeAttendanceByPeriod(
          employeeId,
          startDate,
          endDate,
        );

        const report = this.calculateAttendanceReport(
          employee,
          attendances,
          startDate,
          endDate,
        );

        reports.push(report);
      }

      return reports;
    } catch (error) {
      console.error('Error generating attendance report:', error);
      throw error;
    }
  }

  /**
   * Get daily attendance calendar for an employee
   */
  async getDailyAttendanceCalendar(
    employeeId: string,
    month: number,
    year: number,
  ): Promise<DailyAttendance[]> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      const daysInMonth = endDate.getDate();

      const attendances = await getEmployeeAttendanceByPeriod(
        employeeId,
        startDate,
        endDate,
      );

      const dailyAttendances: DailyAttendance[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.toLocaleDateString('es-ES', { weekday: 'long' });
        const isWorkingDay = this.settings.workingDays.includes(date.getDay());

        const attendance = attendances.find(
          (a) => new Date(a.date).toDateString() === date.toDateString(),
        );

        const status = attendance
          ? attendance.status
          : isWorkingDay
            ? AttendanceStatusEnum.ABSENT
            : AttendanceStatusEnum.HOLIDAY;

        dailyAttendances.push({
          date,
          dayOfWeek,
          isWorkingDay,
          attendance,
          expectedCheckIn: this.settings.standardCheckIn,
          expectedCheckOut: this.settings.standardCheckOut,
          status,
        });
      }

      return dailyAttendances;
    } catch (error) {
      console.error('Error generating daily attendance calendar:', error);
      throw error;
    }
  }

  /**
   * Calculate late arrivals and early departures
   */
  analyzeAttendancePatterns(attendances: Attendance[]): {
    lateArrivals: number;
    earlyDepartures: number;
    perfectAttendance: number;
    averageArrivalTime: string;
    averageDepartureTime: string;
  } {
    let lateArrivals = 0;
    let earlyDepartures = 0;
    let perfectAttendance = 0;
    const arrivalTimes: number[] = [];
    const departureTimes: number[] = [];

    const [standardHour, standardMinute] = this.settings.standardCheckIn
      .split(':')
      .map(Number);
    const standardCheckInTime = standardHour * 60 + standardMinute;

    const [stdOutHour, stdOutMinute] = this.settings.standardCheckOut
      .split(':')
      .map(Number);
    const standardCheckOutTime = stdOutHour * 60 + stdOutMinute;

    attendances.forEach((attendance) => {
      if (attendance.checkIn) {
        const checkInDate = new Date(attendance.checkIn);
        const arrivalMinutes =
          checkInDate.getHours() * 60 + checkInDate.getMinutes();
        arrivalTimes.push(arrivalMinutes);

        if (
          arrivalMinutes >
          standardCheckInTime + this.settings.lateThresholdMinutes
        ) {
          lateArrivals++;
        }
      }

      if (attendance.checkOut) {
        const checkOutDate = new Date(attendance.checkOut);
        const departureMinutes =
          checkOutDate.getHours() * 60 + checkOutDate.getMinutes();
        departureTimes.push(departureMinutes);

        if (
          departureMinutes <
          standardCheckOutTime - this.settings.earlyDepartureThresholdMinutes
        ) {
          earlyDepartures++;
        }
      }

      // Perfect attendance: on time arrival and full day completion
      if (
        attendance.checkIn &&
        attendance.checkOut &&
        attendance.totalHours >= this.settings.standardWorkHours
      ) {
        const checkInDate = new Date(attendance.checkIn);
        const arrivalMinutes =
          checkInDate.getHours() * 60 + checkInDate.getMinutes();

        if (
          arrivalMinutes <=
          standardCheckInTime + this.settings.lateThresholdMinutes
        ) {
          perfectAttendance++;
        }
      }
    });

    const avgArrival =
      arrivalTimes.length > 0
        ? arrivalTimes.reduce((a, b) => a + b, 0) / arrivalTimes.length
        : standardCheckInTime;

    const avgDeparture =
      departureTimes.length > 0
        ? departureTimes.reduce((a, b) => a + b, 0) / departureTimes.length
        : standardCheckOutTime;

    return {
      lateArrivals,
      earlyDepartures,
      perfectAttendance,
      averageArrivalTime: this.minutesToTimeString(avgArrival),
      averageDepartureTime: this.minutesToTimeString(avgDeparture),
    };
  }

  private calculateAttendanceSummary(
    employee: Employee,
    attendances: Attendance[],
    workingDays: number,
    month: number,
    year: number,
  ): AttendanceSummary {
    const presentDays = attendances.filter(
      (a) => a.status === AttendanceStatusEnum.PRESENT,
    ).length;
    const absentDays = attendances.filter(
      (a) => a.status === AttendanceStatusEnum.ABSENT,
    ).length;
    const lateDays = attendances.filter(
      (a) => a.status === AttendanceStatusEnum.LATE,
    ).length;
    const earlyDepartures = attendances.filter(
      (a) => a.status === AttendanceStatusEnum.EARLY_DEPARTURE,
    ).length;
    const holidayDays = attendances.filter(
      (a) => a.status === AttendanceStatusEnum.HOLIDAY,
    ).length;
    const sickLeaveDays = attendances.filter(
      (a) => a.status === AttendanceStatusEnum.SICK_LEAVE,
    ).length;
    const vacationDays = attendances.filter(
      (a) => a.status === AttendanceStatusEnum.VACATION,
    ).length;

    const totalHours = attendances.reduce((sum, a) => sum + a.totalHours, 0);
    const overtimeHours = attendances.reduce(
      (sum, a) => sum + a.overtimeHours,
      0,
    );
    const regularHours = totalHours - overtimeHours;

    const attendanceRate =
      workingDays > 0 ? (presentDays / workingDays) * 100 : 0;

    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      department: employee.department,
      position: employee.position,
      month,
      year,
      workingDays,
      presentDays,
      absentDays,
      lateDays,
      earlyDepartures,
      holidayDays,
      sickLeaveDays,
      vacationDays,
      totalHours,
      regularHours,
      overtimeHours,
      attendanceRate,
    };
  }

  private calculateAttendanceReport(
    employee: Employee,
    attendances: Attendance[],
    startDate: Date,
    endDate: Date,
  ): AttendanceReport {
    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const presentDays = attendances.filter(
      (a) => a.status === AttendanceStatusEnum.PRESENT,
    ).length;
    const absentDays = attendances.filter(
      (a) => a.status === AttendanceStatusEnum.ABSENT,
    ).length;
    const lateDays = attendances.filter(
      (a) => a.status === AttendanceStatusEnum.LATE,
    ).length;
    const totalHours = attendances.reduce((sum, a) => sum + a.totalHours, 0);
    const overtimeHours = attendances.reduce(
      (sum, a) => sum + a.overtimeHours,
      0,
    );

    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      totalHours,
      overtimeHours,
      period: {
        startDate,
        endDate,
      },
    };
  }

  private getWorkingDaysInMonth(month: number, year: number): number {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    let workingDays = 0;

    for (
      let date = new Date(startDate);
      date <= endDate;
      date.setDate(date.getDate() + 1)
    ) {
      if (this.settings.workingDays.includes(date.getDay())) {
        workingDays++;
      }
    }

    return workingDays;
  }

  static validateAttendanceRecord(
    attendance: Attendance,
  ): AttendanceCleanupResult {
    const issues: string[] = [];
    let shouldRemove = false;

    // Validar campos requeridos
    if (!attendance.id) {
      issues.push('Registro sin ID');
      shouldRemove = true;
    }

    if (!attendance.employeeId) {
      issues.push('Registro sin ID de empleado');
      shouldRemove = true;
    }

    if (!attendance.date) {
      issues.push('Registro sin fecha');
      shouldRemove = true;
    }

    // Validar coherencia de checkIn/checkOut
    if (attendance.checkOut && !attendance.checkIn) {
      issues.push('Checkout sin checkin correspondiente');
      shouldRemove = true;
    }

    // Validar fechas
    if (attendance.checkIn && attendance.checkOut) {
      const checkInTime = new Date(attendance.checkIn);
      const checkOutTime = new Date(attendance.checkOut);

      if (checkOutTime <= checkInTime) {
        issues.push('Checkout anterior al checkin');
        shouldRemove = true;
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      shouldRemove,
    };
  }

  private minutesToTimeString(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}

export const attendanceReportService = new AttendanceReportService();
