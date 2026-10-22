'use client';

import { useCallback, useState, useEffect } from 'react';
import { AttendanceSummary, DailyAttendance } from '@odin6/types';
import { attendanceReportService } from '@/services/attendanceService';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
}

interface UseAttendanceReportDataProps {
  employeesData: Employee[];
}

interface AttendanceFilters {
  selectedMonth: number;
  selectedYear: number;
  selectedEmployee: string;
  selectedDepartment: string;
}

interface AttendanceReportDataState {
  attendanceSummaries: AttendanceSummary[];
  dailyCalendar: DailyAttendance[];
  loading: boolean;
  error: string | null;
}

export const useAttendanceReportData = ({
  employeesData,
}: UseAttendanceReportDataProps) => {
  const [state, setState] = useState<AttendanceReportDataState>({
    attendanceSummaries: [],
    dailyCalendar: [],
    loading: false,
    error: null,
  });

  const [filters, setFilters] = useState<AttendanceFilters>({
    selectedMonth: new Date().getMonth() + 1,
    selectedYear: new Date().getFullYear(),
    selectedEmployee: 'all',
    selectedDepartment: 'all',
  });

  const getFilteredEmployees = useCallback((): Employee[] => {
    let filtered = employeesData;

    if (filters.selectedEmployee !== 'all') {
      filtered = filtered.filter((emp) => emp.id === filters.selectedEmployee);
    }

    if (filters.selectedDepartment !== 'all') {
      filtered = filtered.filter(
        (emp) => emp.department === filters.selectedDepartment,
      );
    }

    return filtered;
  }, [filters, employeesData]);

  const getDepartments = useCallback((): string[] => {
    return [...new Set(employeesData.map((emp) => emp.department))].filter(
      Boolean,
    ) as string[];
  }, [employeesData]);

  const generateReports = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const filteredEmployees = getFilteredEmployees();
      const summaries: AttendanceSummary[] = [];

      for (const employee of filteredEmployees) {
        const summary =
          await attendanceReportService.generateEmployeeAttendanceSummary(
            employee.id,
            filters.selectedMonth,
            filters.selectedYear,
          );
        if (summary) {
          summaries.push(summary);
        }
      }

      let dailyCalendar: DailyAttendance[] = [];
      if (filters.selectedEmployee !== 'all') {
        dailyCalendar =
          await attendanceReportService.getDailyAttendanceCalendar(
            filters.selectedEmployee,
            filters.selectedMonth,
            filters.selectedYear,
          );
      }

      setState((prev) => ({
        ...prev,
        attendanceSummaries: summaries,
        dailyCalendar,
        loading: false,
      }));
    } catch (err) {
      console.error('Error generating reports:', err);
      setState((prev) => ({
        ...prev,
        error: 'Error al generar reportes',
        loading: false,
      }));
    }
  }, [filters, getFilteredEmployees]);

  useEffect(() => {
    if (employeesData.length > 0) {
      generateReports();
    }
  }, [generateReports, employeesData.length]);

  return {
    ...state,
    filters,
    setFilters,
    getFilteredEmployees,
    getDepartments,
  };
};
