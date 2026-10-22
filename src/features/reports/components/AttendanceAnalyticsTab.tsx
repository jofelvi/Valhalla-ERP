import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AttendanceCategoriesStats {
  perfect: number;
  regular: number;
  low: number;
}

interface AdditionalStats {
  totalVacationDays: number;
  totalSickLeaveDays: number;
  averageHoursPerEmployee: string;
}

interface AttendanceAnalyticsTabProps {
  categories: AttendanceCategoriesStats;
  additionalStats: AdditionalStats;
}

export const AttendanceAnalyticsTab: React.FC<AttendanceAnalyticsTabProps> = ({
  categories,
  additionalStats,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Tendencias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">
                Empleados con asistencia perfecta (95%+):
              </span>
              <Badge className="bg-ok/10 text-ok">{categories.perfect}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">
                Empleados con asistencia regular (85-94%):
              </span>
              <Badge className="bg-accent/10 text-accent">
                {categories.regular}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">
                Empleados con baja asistencia (&lt;85%):
              </span>
              <Badge className="bg-danger/10 text-danger">
                {categories.low}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estadísticas Adicionales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Total días de vacaciones:</span>
              <span className="font-medium">
                {additionalStats.totalVacationDays} días
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Total días de permiso médico:</span>
              <span className="font-medium">
                {additionalStats.totalSickLeaveDays} días
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Promedio horas por empleado:</span>
              <span className="font-medium">
                {additionalStats.averageHoursPerEmployee}h
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
