import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ClockArrowDownIcon } from 'lucide-react';
import { Employee } from '@odin6/types';
import { Attendance } from '@odin6/types';
import { formatTime, formatDate, calculateWorkedHours } from '../utils';
import { StatusBadge } from './StatusBadge';

interface ReviewStepProps {
  employee: Employee | null;
  todayAttendance: Attendance | null;
  notes: string;
  onNotesChange: (notes: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

/**
 * Step de revisión - empleado revisa su jornada antes de proceder a cámara
 */
export const ReviewStep = ({
  employee,
  todayAttendance,
  notes,
  onNotesChange,
  onContinue,
  onBack,
}: ReviewStepProps) => {
  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-brand/15 rounded-full flex items-center justify-center mx-auto mb-4">
          <ClockArrowDownIcon className="h-8 w-8 text-brand" />
        </div>
        <CardTitle className="text-2xl">Resumen del Día</CardTitle>
        <p className="text-dim">Revisa tu jornada laboral</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-elevated rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-dim">Empleado:</span>
            <span className="font-medium">
              {employee?.firstName} {employee?.lastName}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-dim">Fecha:</span>
            <span className="font-medium">{formatDate(new Date())}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-dim">
              Hora de Entrada:
            </span>
            <span className="font-medium text-ok">
              {todayAttendance?.checkIn
                ? formatTime(todayAttendance.checkIn)
                : 'N/A'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-dim">Hora Actual:</span>
            <span className="font-medium text-accent">
              {formatTime(new Date())}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-dim">
              Horas Trabajadas:
            </span>
            <span className="font-medium text-brand">
              {calculateWorkedHours(todayAttendance?.checkIn)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-dim">Estado:</span>
            {todayAttendance?.status && (
              <StatusBadge status={todayAttendance.status} />
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Notas Adicionales (Opcional)</Label>
          <Textarea
            id="notes"
            placeholder="Agrega cualquier comentario sobre tu jornada..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="mt-1"
            rows={3}
          />
        </div>

        <Button onClick={onContinue} className="w-full">
          Continuar
        </Button>

        <Button variant="outline" onClick={onBack} className="w-full">
          Volver
        </Button>
      </CardContent>
    </Card>
  );
};
