import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Employee } from '@odin6/types';
import { formatDate, formatTime } from '../utils';

interface PreviewStepProps {
  employee: Employee | null;
  photoUrl: string | null;
  loading: boolean;
  onContinue: () => void;
  onRetry: () => void;
}

/**
 * Step de preview - empleado confirma su foto capturada
 */
export const PreviewStep = ({
  employee,
  photoUrl,
  loading,
  onContinue,
  onRetry,
}: PreviewStepProps) => {
  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Confirmar Foto</CardTitle>
        <p className="text-dim">
          {employee?.firstName} {employee?.lastName}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <Image
            src={photoUrl || ''}
            alt="Foto capturada"
            width={400}
            height={300}
            className="w-full h-64 object-cover rounded-lg mb-4"
          />

          <div className="bg-elevated rounded-lg p-4 mb-4">
            <div className="text-sm text-dim">
              <p>
                <strong>Empleado:</strong> {employee?.firstName}{' '}
                {employee?.lastName}
              </p>
              <p>
                <strong>Fecha:</strong> {formatDate(new Date())}
              </p>
              <p>
                <strong>Hora:</strong> {formatTime(new Date())}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={onContinue} disabled={loading} className="flex-1">
            Continuar
          </Button>
          <Button variant="outline" onClick={onRetry}>
            Repetir Foto
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
