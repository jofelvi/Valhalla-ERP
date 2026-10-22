import React from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  TrendingUpIcon,
  UsersIcon,
  XCircleIcon,
} from 'lucide-react';
import { StatCard } from './StatCard';

interface OverallStats {
  totalEmployees: number;
  averageAttendanceRate: number;
  totalPresentDays: number;
  totalAbsentDays: number;
  totalOvertimeHours: number;
}

interface AttendanceStatsGridProps {
  stats: OverallStats;
  getAttendanceRateColor: (rate: number) => string;
  formatPercentage: (value: number) => string;
}

export const AttendanceStatsGrid: React.FC<AttendanceStatsGridProps> = ({
  stats,
  getAttendanceRateColor,
  formatPercentage,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <StatCard
        icon={<UsersIcon className="h-5 w-5 text-brand" />}
        iconBgColor="bg-brand/10"
        label="Empleados"
        value={stats.totalEmployees}
        valueColor="text-brand"
      />

      <StatCard
        icon={<TrendingUpIcon className="h-5 w-5 text-ok" />}
        iconBgColor="bg-ok/10"
        label="Asistencia Promedio"
        value={formatPercentage(stats.averageAttendanceRate)}
        valueColor={getAttendanceRateColor(stats.averageAttendanceRate)}
      />

      <StatCard
        icon={<CheckCircleIcon className="h-5 w-5 text-ok" />}
        iconBgColor="bg-ok/10"
        label="Días Presente"
        value={stats.totalPresentDays}
        valueColor="text-ok"
      />

      <StatCard
        icon={<XCircleIcon className="h-5 w-5 text-danger" />}
        iconBgColor="bg-danger/10"
        label="Días Ausente"
        value={stats.totalAbsentDays}
        valueColor="text-danger"
      />

      <StatCard
        icon={<ClockIcon className="h-5 w-5 text-brand" />}
        iconBgColor="bg-brand/10"
        label="Horas Extra"
        value={`${stats.totalOvertimeHours.toFixed(1)}h`}
        valueColor="text-brand"
      />
    </div>
  );
};
