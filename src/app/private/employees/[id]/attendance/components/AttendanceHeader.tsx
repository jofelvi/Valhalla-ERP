'use client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  EditIcon,
  PlusIcon,
} from 'lucide-react';
import { Employee } from '@odin6/types';
import { Attendance } from '@odin6/types';

interface AttendanceHeaderProps {
  employee: Employee | undefined;
  todayAttendance: Attendance | undefined;
  onBack: () => void;
  onManualRecord: () => void;
  onCheckIn: () => void;
  onCheckOut: () => void;
  checkOutLoading?: boolean;
}

/**
 * Header de la página de asistencias con botones de acción
 */
export const AttendanceHeader = ({
  employee,
  todayAttendance,
  onBack,
  onManualRecord,
  onCheckIn,
  onCheckOut,
  checkOutLoading = false,
}: AttendanceHeaderProps) => {
  const hasCheckedOut = todayAttendance?.checkOut;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Asistencias</h1>
          <p className="text-dim">
            {employee?.firstName} {employee?.lastName}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button
          onClick={onManualRecord}
          variant="outline"
          className="flex items-center gap-2"
        >
          <EditIcon className="h-4 w-4" />
          Registro Manual
        </Button>

        {todayAttendance ? (
          hasCheckedOut ? (
            <Badge className="bg-ok/15 text-ok">
              <CheckCircleIcon className="h-4 w-4 mr-1" />
              Jornada Completada
            </Badge>
          ) : (
            <Button
              onClick={onCheckOut}
              variant="outline"
              className="flex items-center gap-2"
              disabled={checkOutLoading}
            >
              <ClockIcon className="h-4 w-4" />
              Registrar Salida
            </Button>
          )
        ) : (
          <Button onClick={onCheckIn} className="flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            Registrar Entrada
          </Button>
        )}
      </div>
    </div>
  );
};
