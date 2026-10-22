import { useMemo } from 'react';
import React from 'react';
import { AttendanceSummary } from '@odin6/types';
import { AttendanceStatusEnum } from '@/shared';
import {
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  CalendarIcon,
  ClockIcon,
} from 'lucide-react';

interface OverallStats {
  totalEmployees: number;
  averageAttendanceRate: number;
  totalPresentDays: number;
  totalAbsentDays: number;
  totalOvertimeHours: number;
}

export const useAttendanceCalculations = (
  attendanceSummaries: AttendanceSummary[],
) => {
  const overallStats = useMemo<OverallStats>(() => {
    if (attendanceSummaries.length === 0) {
      return {
        totalEmployees: 0,
        averageAttendanceRate: 0,
        totalPresentDays: 0,
        totalAbsentDays: 0,
        totalOvertimeHours: 0,
      };
    }

    const totalEmployees = attendanceSummaries.length;
    const averageAttendanceRate =
      attendanceSummaries.reduce((sum, s) => sum + s.attendanceRate, 0) /
      totalEmployees;
    const totalPresentDays = attendanceSummaries.reduce(
      (sum, s) => sum + s.presentDays,
      0,
    );
    const totalAbsentDays = attendanceSummaries.reduce(
      (sum, s) => sum + s.absentDays,
      0,
    );
    const totalOvertimeHours = attendanceSummaries.reduce(
      (sum, s) => sum + s.overtimeHours,
      0,
    );

    return {
      totalEmployees,
      averageAttendanceRate,
      totalPresentDays,
      totalAbsentDays,
      totalOvertimeHours,
    };
  }, [attendanceSummaries]);

  const getAttendanceRateColor = (rate: number): string => {
    if (rate >= 95) return 'text-ok';
    if (rate >= 85) return 'text-accent';
    return 'text-danger';
  };

  const getAttendanceRateBadge = (rate: number): string => {
    if (rate >= 95) return 'bg-ok/10 text-ok';
    if (rate >= 85) return 'bg-accent/10 text-accent';
    return 'bg-danger/10 text-danger';
  };

  const getStatusIcon = (status: AttendanceStatusEnum): React.ReactNode => {
    switch (status) {
      case AttendanceStatusEnum.PRESENT:
        return React.createElement(CheckCircleIcon, {
          className: 'h-4 w-4 text-ok',
        });
      case AttendanceStatusEnum.ABSENT:
        return React.createElement(XCircleIcon, {
          className: 'h-4 w-4 text-danger',
        });
      case AttendanceStatusEnum.LATE:
        return React.createElement(AlertCircleIcon, {
          className: 'h-4 w-4 text-accent',
        });
      case AttendanceStatusEnum.HOLIDAY:
        return React.createElement(CalendarIcon, {
          className: 'h-4 w-4 text-brand',
        });
      default:
        return React.createElement(ClockIcon, {
          className: 'h-4 w-4 text-dim',
        });
    }
  };

  const formatPercentage = (value: number): string => `${value.toFixed(1)}%`;

  const attendanceCategories = useMemo(
    () => ({
      perfect: attendanceSummaries.filter((s) => s.attendanceRate >= 95).length,
      regular: attendanceSummaries.filter(
        (s) => s.attendanceRate >= 85 && s.attendanceRate < 95,
      ).length,
      low: attendanceSummaries.filter((s) => s.attendanceRate < 85).length,
    }),
    [attendanceSummaries],
  );

  const additionalStats = useMemo(
    () => ({
      totalVacationDays: attendanceSummaries.reduce(
        (sum, s) => sum + s.vacationDays,
        0,
      ),
      totalSickLeaveDays: attendanceSummaries.reduce(
        (sum, s) => sum + s.sickLeaveDays,
        0,
      ),
      averageHoursPerEmployee:
        attendanceSummaries.length > 0
          ? (
              attendanceSummaries.reduce((sum, s) => sum + s.totalHours, 0) /
              attendanceSummaries.length
            ).toFixed(1)
          : '0',
    }),
    [attendanceSummaries],
  );

  return {
    overallStats,
    getAttendanceRateColor,
    getAttendanceRateBadge,
    getStatusIcon,
    formatPercentage,
    attendanceCategories,
    additionalStats,
  };
};
