import React from 'react';
import { Button } from '@/components/ui/button';
import { DownloadIcon } from 'lucide-react';

export const AttendanceHeader: React.FC = () => {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-bold">Reportes de Asistencia</h1>
        <p className="text-dim">
          Análisis detallado de asistencia de empleados
        </p>
      </div>
      <Button className="flex items-center gap-2">
        <DownloadIcon className="h-4 w-4" />
        Exportar Reporte
      </Button>
    </div>
  );
};
