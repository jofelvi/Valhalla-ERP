import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon } from 'lucide-react';
import { DailyAttendance } from '@odin6/types';
import { AttendanceStatusEnum } from '@/shared';

interface AttendanceCalendarTabProps {
  calendar: DailyAttendance[];
  getStatusIcon: (status: AttendanceStatusEnum) => React.ReactNode;
}

export const AttendanceCalendarTab: React.FC<AttendanceCalendarTabProps> = ({
  calendar,
  getStatusIcon,
}) => {
  const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Calendario de Asistencia Diaria
        </CardTitle>
      </CardHeader>
      <CardContent>
        {calendar.length === 0 ? (
          <div className="text-center py-8 text-dim">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-dim" />
            <p>No hay datos de calendario para el período seleccionado</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {/* Day headers */}
            {dayLabels.map((day) => (
              <div
                key={day}
                className="p-2 text-center font-medium text-dim text-sm"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendar.map((day, index) => (
              <div
                key={index}
                className={`
                  p-2 text-center text-sm border rounded-lg h-16 flex flex-col justify-center
                  ${day.isWorkingDay ? 'bg-surface' : 'bg-elevated'}
                  ${day.status === AttendanceStatusEnum.PRESENT ? 'border-ok bg-ok/10' : ''}
                  ${day.status === AttendanceStatusEnum.ABSENT ? 'border-danger bg-danger/10' : ''}
                  ${day.status === AttendanceStatusEnum.LATE ? 'border-accent bg-accent/10' : ''}
                  ${day.status === AttendanceStatusEnum.HOLIDAY ? 'border-brand bg-elevated' : ''}
                `}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="font-medium">{day.date.getDate()}</span>
                  {getStatusIcon(day.status)}
                </div>
                {day.attendance && (
                  <div className="text-xs text-dim">
                    {day.attendance.totalHours.toFixed(1)}h
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
