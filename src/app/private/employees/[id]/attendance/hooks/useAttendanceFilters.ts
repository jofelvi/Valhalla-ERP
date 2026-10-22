import { useMemo, useState } from 'react';
import { Attendance } from '@odin6/types';
import {
  filterAttendancesByMonthYear,
  calculateMonthStats,
  getTodayAttendance,
} from '../utils';

export const useAttendanceFilters = (allAttendances: Attendance[]) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Calcular asistencias filtradas
  const filteredAttendances = useMemo(
    () =>
      filterAttendancesByMonthYear(allAttendances, selectedMonth, selectedYear),
    [allAttendances, selectedMonth, selectedYear],
  );

  // Calcular estadísticas del mes
  const monthStats = useMemo(
    () => calculateMonthStats(filteredAttendances),
    [filteredAttendances],
  );

  // Obtener asistencia de hoy
  const todayAttendance = useMemo(
    () => getTodayAttendance(allAttendances),
    [allAttendances],
  );

  return {
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    filteredAttendances,
    monthStats,
    todayAttendance,
  };
};
