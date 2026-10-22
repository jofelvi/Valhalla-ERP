import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircleIcon } from 'lucide-react';
import { Employee } from '@odin6/types';
import { Attendance } from '@odin6/types';
import { formatDate, formatTime, calculateWorkedHours } from '../utils';

interface SuccessStepProps {
  employee: Employee | null;
  todayAttendance: Attendance | null;
  onRegisterAnother: () => void;
}

/**
 * Step de éxito - confirmación de salida registrada
 */
export const SuccessStep = ({
  employee,
  todayAttendance,
  onRegisterAnother,
}: SuccessStepProps) => {
  const router = useRouter();

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-ok/15 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircleIcon className="h-8 w-8 text-ok" />
        </div>
        <CardTitle className="text-2xl text-ok">¡Salida Registrada!</CardTitle>
        <p className="text-dim">Tu salida ha sido registrada exitosamente</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-ok/15 rounded-lg p-4 space-y-2">
          <div className="text-center">
            <p className="text-lg font-semibold">
              {employee?.firstName} {employee?.lastName}
            </p>
            <p className="text-sm text-dim">{formatDate(new Date())}</p>
            <p className="text-2xl font-bold text-ok">
              {formatTime(new Date())}
            </p>
          </div>

          <div className="border-t pt-3">
            <div className="text-center">
              <p className="text-sm text-dim">Jornada Completada</p>
              <p className="text-lg font-bold text-brand">
                {calculateWorkedHours(todayAttendance?.checkIn)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            onClick={() => router.push('/private/employees')}
            className="w-full"
          >
            Ir al Panel Principal
          </Button>

          <Button
            variant="outline"
            onClick={onRegisterAnother}
            className="w-full"
          >
            Registrar Otra Salida
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
