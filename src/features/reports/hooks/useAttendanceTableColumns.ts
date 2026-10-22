import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { AttendanceSummary } from '@odin6/types';
import {
  EmployeeNameCell,
  DepartmentCell,
  PresentDaysCell,
  AbsentDaysCell,
  LateDaysCell,
  TotalHoursCell,
  OvertimeHoursCell,
  AttendanceRateCell,
} from './tableColumnsCells';

interface UseAttendanceTableColumnsProps {
  getAttendanceRateBadge: (rate: number) => string;
  formatPercentage: (value: number) => string;
}

export const useAttendanceTableColumns = ({
  getAttendanceRateBadge,
  formatPercentage,
}: UseAttendanceTableColumnsProps) => {
  const columns = useMemo(() => {
    const cols: ColumnDef<AttendanceSummary>[] = [
      {
        accessorKey: 'employeeName',
        header: 'Empleado',
        cell: ({ row }) => EmployeeNameCell(row.original),
      },
      {
        accessorKey: 'department',
        header: 'Departamento',
        cell: ({ row }) => DepartmentCell(row.original),
      },
      {
        accessorKey: 'presentDays',
        header: 'Días Trabajados',
        cell: ({ row }) => PresentDaysCell(row.original),
      },
      {
        accessorKey: 'absentDays',
        header: 'Faltas',
        cell: ({ row }) => AbsentDaysCell(row.original),
      },
      {
        accessorKey: 'lateDays',
        header: 'Tardanzas',
        cell: ({ row }) => LateDaysCell(row.original),
      },
      {
        accessorKey: 'totalHours',
        header: 'Horas Totales',
        cell: ({ row }) => TotalHoursCell(row.original),
      },
      {
        accessorKey: 'overtimeHours',
        header: 'Horas Extra',
        cell: ({ row }) => OvertimeHoursCell(row.original),
      },
      {
        accessorKey: 'attendanceRate',
        header: '% Asistencia',
        cell: ({ row }) =>
          AttendanceRateCell(
            row.original,
            getAttendanceRateBadge,
            formatPercentage,
          ),
      },
    ];

    return cols;
  }, [getAttendanceRateBadge, formatPercentage]);

  return columns;
};
