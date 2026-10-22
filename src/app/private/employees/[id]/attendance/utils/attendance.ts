import { AttendanceStatusEnum } from '@/shared';
import { Attendance } from '@odin6/types';

/**
 * Busca la asistencia del día actual
 */
export const getTodayAttendance = (
  allAttendances: Attendance[],
): Attendance | undefined => {
  const today = new Date();
  const todayString = today.toDateString();

  const found = allAttendances.find((a) => {
    const attendanceDate = new Date(a.date);
    return attendanceDate.toDateString() === todayString;
  });

  return found;
};

/**
 * Filtra asistencias por mes y año
 */
export const filterAttendancesByMonthYear = (
  allAttendances: Attendance[],
  month: number,
  year: number,
): Attendance[] => {
  return allAttendances.filter((attendance) => {
    const attendanceDate = new Date(attendance.date);
    return (
      attendanceDate.getMonth() === month - 1 &&
      attendanceDate.getFullYear() === year
    );
  });
};

/**
 * Calcula estadísticas del mes de asistencias
 */
export const calculateMonthStats = (
  filteredAttendances: Attendance[],
): {
  worked: number;
  absent: number;
  late: number;
  totalHours: number;
} => {
  return {
    worked: filteredAttendances.filter(
      (a) => a.status === AttendanceStatusEnum.PRESENT,
    ).length,
    absent: filteredAttendances.filter(
      (a) => a.status === AttendanceStatusEnum.ABSENT,
    ).length,
    late: filteredAttendances.filter(
      (a) => a.status === AttendanceStatusEnum.LATE,
    ).length,
    totalHours: filteredAttendances.reduce((acc, a) => acc + a.totalHours, 0),
  };
};

/**
 * Config de estilos para cada estado de asistencia
 */
export const getStatusConfig = (status: AttendanceStatusEnum) => {
  const statusConfigMap: Record<
    AttendanceStatusEnum,
    { color: string; icon: string }
  > = {
    [AttendanceStatusEnum.PRESENT]: {
      color: 'bg-ok/15 text-ok',
      icon: 'CheckCircleIcon',
    },
    [AttendanceStatusEnum.ABSENT]: {
      color: 'bg-danger/15 text-danger',
      icon: 'XCircleIcon',
    },
    [AttendanceStatusEnum.LATE]: {
      color: 'bg-accent/15 text-accent',
      icon: 'AlertCircleIcon',
    },
    [AttendanceStatusEnum.EARLY_DEPARTURE]: {
      color: 'bg-accent/15 text-accent',
      icon: 'AlertCircleIcon',
    },
    [AttendanceStatusEnum.HOLIDAY]: {
      color: 'bg-brand/15 text-brand',
      icon: 'CalendarIcon',
    },
    [AttendanceStatusEnum.SICK_LEAVE]: {
      color: 'bg-brand/15 text-brand',
      icon: 'XCircleIcon',
    },
    [AttendanceStatusEnum.VACATION]: {
      color: 'bg-brand/15 text-brand',
      icon: 'CalendarIcon',
    },
    [AttendanceStatusEnum.MEDICALREST]: {
      color: 'bg-elevated text-content',
      icon: 'XCircleIcon',
    },
  };

  return (
    statusConfigMap[status] || statusConfigMap[AttendanceStatusEnum.ABSENT]
  );
};
