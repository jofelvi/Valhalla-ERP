import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UsersIcon, BarChart3Icon } from 'lucide-react';
import { AttendanceSummary } from '@odin6/types';
import Table from '@/components/shared/Table';
import { MobileSummaryCard } from './MobileSummaryCard';

interface AttendanceSummaryTabProps {
  summaries: AttendanceSummary[];
  columns: ColumnDef<AttendanceSummary>[];
  getAttendanceRateBadge: (rate: number) => string;
  formatPercentage: (value: number) => string;
}

export const AttendanceSummaryTab: React.FC<AttendanceSummaryTabProps> = ({
  summaries,
  columns,
  getAttendanceRateBadge,
  formatPercentage,
}) => {
  return (
    <Card className="bg-surface border-line shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3Icon className="h-5 w-5" />
          Resumen de Asistencia por Empleado
        </CardTitle>
      </CardHeader>
      <CardContent>
        {summaries.length === 0 ? (
          <div className="text-center py-8 text-dim">
            <UsersIcon className="h-12 w-12 mx-auto mb-4 text-dim" />
            <p>No hay datos de asistencia para el período seleccionado</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table data={summaries} columns={columns} />
            </div>

            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {summaries.map((summary) => (
                <MobileSummaryCard
                  key={summary.employeeId}
                  summary={summary}
                  getAttendanceRateBadge={getAttendanceRateBadge}
                  formatPercentage={formatPercentage}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
