import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClockIcon } from 'lucide-react';
import { Employee } from '@odin6/types';
import { Attendance } from '@odin6/types';
import { formatDate, formatTime, calculateWorkedHours } from '../utils';

interface ConfirmStepProps {
  employee: Employee | null;
  todayAttendance: Attendance | null;
  loading: boolean;
  onConfirm: () => Promise<void>;
  onBack: () => void;
}

/**
 * Step de confirmación final antes de registrar salida
 */
export const ConfirmStep = ({
  employee,
  todayAttendance,
  loading,
  onConfirm,
  onBack,
}: ConfirmStepProps) => {
  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-accent/15 rounded-full flex items-center justify-center mx-auto mb-4">
          <ClockIcon className="h-8 w-8 text-accent" />
        </div>
        <CardTitle className="text-2xl">Confirmar Salida</CardTitle>
        <p className="text-dim">¿Estás seguro de registrar tu salida?</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-accent/15 rounded-lg p-4 space-y-3">
          <div className="text-center">
            <p className="text-lg font-semibold">
              {employee?.firstName} {employee?.lastName}
            </p>
            <p className="text-sm text-dim">{formatDate(new Date())}</p>
            <p className="text-2xl font-bold text-accent">
              {formatTime(new Date())}
            </p>
          </div>

          <div className="border-t pt-3">
            <div className="flex justify-between text-sm">
              <span>Entrada:</span>
              <span className="font-medium">
                {todayAttendance?.checkIn
                  ? formatTime(todayAttendance.checkIn)
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Salida:</span>
              <span className="font-medium">{formatTime(new Date())}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total:</span>
              <span className="font-medium">
                {calculateWorkedHours(todayAttendance?.checkIn)}
              </span>
            </div>
          </div>
        </div>

        <Button
          onClick={onConfirm}
          disabled={loading}
          className="w-full bg-accent hover:bg-accent"
        >
          {loading ? 'Registrando...' : 'Confirmar Salida'}
        </Button>

        <Button variant="outline" onClick={onBack} className="w-full">
          Volver
        </Button>
      </CardContent>
    </Card>
  );
};
