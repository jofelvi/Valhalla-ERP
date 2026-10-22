import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CameraIcon } from 'lucide-react';
import { Employee } from '@odin6/types';
import { UseCameraCaptureReturn } from '../hooks';

interface CameraStepProps {
  employee: Employee | null;
  camera: UseCameraCaptureReturn;
  loading: boolean;
  onCaptureComplete: () => void;
  onCancel: () => void;
}

/**
 * Step de cámara - empleado captura su foto de salida
 */
export const CameraStep = ({
  employee,
  camera,
  loading,
  onCaptureComplete,
  onCancel,
}: CameraStepProps) => {
  const handleCapturePhoto = () => {
    camera.capturePhoto();
    onCaptureComplete();
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-brand/15 rounded-full flex items-center justify-center mx-auto mb-4">
          <CameraIcon className="h-8 w-8 text-brand" />
        </div>
        <CardTitle className="text-xl">Foto Obligatoria</CardTitle>
        <p className="text-dim">
          {employee?.firstName} {employee?.lastName}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!camera.cameraStream && (
          <div className="text-center">
            <p className="text-sm text-dim mb-4">
              Es obligatorio tomar una foto para registrar tu salida
            </p>
            <Button
              onClick={camera.startCamera}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Iniciando cámara...' : 'Activar Cámara'}
            </Button>
          </div>
        )}

        {camera.cameraStream && (
          <div className="text-center space-y-4">
            <div className="relative">
              <video
                id="camera-video"
                autoPlay
                playsInline
                className="w-full h-64 object-cover rounded-lg bg-elevated"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCapturePhoto} className="flex-1">
                <CameraIcon className="h-4 w-4 mr-2" />
                Tomar Foto
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
