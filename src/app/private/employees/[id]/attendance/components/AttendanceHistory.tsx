'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon } from 'lucide-react';
import { Attendance, AttendanceStatusEnum } from '@odin6/types';
import { formatTime, formatDate, getStatusConfig } from '../utils';

interface AttendanceHistoryProps {
  filteredAttendances: Attendance[];
  isLoading: boolean;
}

/**
 * Tabla de historial de asistencias
 */
export const AttendanceHistory = ({
  filteredAttendances,
  isLoading,
}: AttendanceHistoryProps) => {
  const StatusBadge = ({ status }: { status: AttendanceStatusEnum }) => {
    const config = getStatusConfig(status);

    return (
      <Badge className={`${config.color} border-0`}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Asistencias</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand"></div>
          </div>
        ) : filteredAttendances.length === 0 ? (
          <div className="text-center py-8 text-dim">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-dim" />
            <p>No hay registros de asistencia para este período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Fecha</th>
                  <th className="text-left py-2">Entrada</th>
                  <th className="text-left py-2">Salida</th>
                  <th className="text-left py-2">Horas</th>
                  <th className="text-left py-2">Estado</th>
                  <th className="text-left py-2">Notas</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendances.map((attendance) => (
                  <tr
                    key={attendance.id}
                    className="border-b hover:bg-elevated"
                  >
                    <td className="py-2">{formatDate(attendance.date)}</td>
                    <td className="py-2">{formatTime(attendance.checkIn)}</td>
                    <td className="py-2">{formatTime(attendance.checkOut)}</td>
                    <td className="py-2">
                      {attendance.totalHours.toFixed(1)}h
                    </td>
                    <td className="py-2">
                      <StatusBadge status={attendance.status} />
                    </td>
                    <td className="py-2 text-dim">{attendance.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
