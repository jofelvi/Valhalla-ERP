'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClockIcon } from 'lucide-react';
import { Attendance, AttendanceStatusEnum } from '@odin6/types';
import { formatTime, getStatusConfig } from '../utils';

interface AttendanceSummaryProps {
  monthStats: {
    worked: number;
    absent: number;
    late: number;
    totalHours: number;
  };
  todayAttendance: Attendance | undefined;
}

/**
 * Componente con dos cards: resumen del mes y estado actual
 */
export const AttendanceSummary = ({
  monthStats,
  todayAttendance,
}: AttendanceSummaryProps) => {
  const StatusBadge = ({ status }: { status: AttendanceStatusEnum }) => {
    const config = getStatusConfig(status);

    return (
      <Badge className={`${config.color} border-0`}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Resumen del Mes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-dim">Días trabajados:</span>
              <span className="font-medium">{monthStats.worked}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-dim">Faltas:</span>
              <span className="font-medium">{monthStats.absent}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-dim">Tardanzas:</span>
              <span className="font-medium">{monthStats.late}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-dim">Horas totales:</span>
              <span className="font-medium">
                {monthStats.totalHours.toFixed(1)}h
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Estado Actual</CardTitle>
        </CardHeader>
        <CardContent>
          {todayAttendance ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-dim">Estado:</span>
                <StatusBadge status={todayAttendance.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-dim">Entrada:</span>
                <span className="font-medium">
                  {formatTime(todayAttendance.checkIn)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-dim">Salida:</span>
                <span className="font-medium">
                  {formatTime(todayAttendance.checkOut)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-dim">Horas:</span>
                <span className="font-medium">
                  {todayAttendance.totalHours.toFixed(1)}h
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-dim">
              <ClockIcon className="h-8 w-8 mx-auto mb-2 text-dim" />
              <p className="text-sm">No hay registro de hoy</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};
