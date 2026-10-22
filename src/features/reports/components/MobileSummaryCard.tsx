import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AttendanceSummary } from '@odin6/types';

interface MobileSummaryCardProps {
  summary: AttendanceSummary;
  getAttendanceRateBadge: (rate: number) => string;
  formatPercentage: (value: number) => string;
}

export const MobileSummaryCard: React.FC<MobileSummaryCardProps> = ({
  summary,
  getAttendanceRateBadge,
  formatPercentage,
}) => {
  return (
    <div className="bg-elevated border border-line rounded-xl p-4 shadow-sm relative">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="font-bold text-content text-base leading-tight">
            {summary.employeeName}
          </p>
          <p className="text-[11px] text-dim mb-2 uppercase tracking-wide">
            {summary.position} • {summary.department}
          </p>
        </div>
        <Badge className={getAttendanceRateBadge(summary.attendanceRate)}>
          {formatPercentage(summary.attendanceRate)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm mt-1 border-t border-line/50 pt-3">
        <div className="flex flex-col">
          <span className="text-dim text-[11px] uppercase mb-1">
            Días Trabajados
          </span>
          <div>
            <span className="font-medium text-ok">{summary.presentDays}</span>
            <span className="text-dim text-xs"> / {summary.workingDays}</span>
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-dim text-[11px] uppercase mb-1">
            Faltas / Tarde
          </span>
          <div>
            <span className="font-bold text-danger">{summary.absentDays}</span>
            <span className="text-dim text-xs mx-1">/</span>
            <span className="font-medium text-accent">{summary.lateDays}</span>
          </div>
        </div>

        <div className="flex flex-col bg-surface p-2 rounded-lg border border-line">
          <span className="text-dim text-[11px] uppercase mb-1">
            Horas Totales
          </span>
          <span className="font-medium text-content">
            {summary.totalHours.toFixed(1)}h
          </span>
        </div>

        <div className="flex flex-col bg-brand/5 p-2 rounded-lg border border-brand/20">
          <span className="text-dim text-[11px] uppercase mb-1">
            Horas Extra
          </span>
          <span className="font-medium text-brand">
            {summary.overtimeHours.toFixed(1)}h
          </span>
        </div>
      </div>
    </div>
  );
};
