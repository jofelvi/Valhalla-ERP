'use client';
import Modal from '@/components/shared/modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CameraIcon,
  MapPinIcon,
  CheckCircleIcon,
  UserIcon,
} from 'lucide-react';
import { Employee } from '@odin6/types';
import { CameraStep } from '../hooks';
import { formatDate, formatTime } from '../utils';

interface CheckInModalProps {
  isOpen: boolean;
  employee: Employee | undefined;
  cameraStep: CameraStep;
  photoUrl: string | null;
  cameraStream: MediaStream | null;
  location: { latitude: number; longitude: number; accuracy: number } | null;
  error: string | null;
  checkInLoading: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onClose: () => void;
  onStartCamera: () => void;
  onCapturePhoto: () => void;
  onRetryPhoto: () => void;
  onRequestLocation: () => void;
  onConfirmCheckIn: () => void;
  onCancel: () => void;
}

/**
 * Modal para el flujo de check-in con cámara y ubicación
 */
export const CheckInModal = ({
  isOpen,
  employee,
  cameraStep,
  photoUrl,
  cameraStream,
  location,
  error,
  checkInLoading,
  videoRef,
  onClose,
  onStartCamera,
  onCapturePhoto,
  onRetryPhoto,
  onRequestLocation,
  onConfirmCheckIn,
  onCancel,
}: CheckInModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black"
      classNameWrap="p-4"
      className="bg-surface rounded-lg shadow-xl max-w-md w-full"
    >
      {/* Paso 1: Cámara */}
      {cameraStep === 'camera' && (
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-brand/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <CameraIcon className="h-8 w-8 text-brand" />
            </div>
            <CardTitle className="text-xl">Verificación de Identidad</CardTitle>
            <p className="text-dim">
              Toma una foto para confirmar tu identidad
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <UserIcon className="h-5 w-5 text-dim" />
                <span className="font-medium">
                  {employee?.firstName} {employee?.lastName}
                </span>
              </div>
            </div>

            {!cameraStream && !photoUrl && (
              <div className="text-center">
                <p className="text-sm text-dim mb-4">
                  Presiona el botón para activar la cámara
                </p>
                <Button
                  onClick={onStartCamera}
                  disabled={checkInLoading}
                  className="w-full"
                >
                  {checkInLoading ? 'Iniciando cámara...' : 'Activar Cámara'}
                </Button>
              </div>
            )}

            {cameraStream && !photoUrl && (
              <div className="text-center space-y-4">
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-64 object-cover rounded-lg bg-elevated"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={onCapturePhoto} className="flex-1">
                    <CameraIcon className="h-4 w-4 mr-2" />
                    Tomar Foto
                  </Button>
                  <Button variant="outline" onClick={onCancel}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {photoUrl && (
              <div className="text-center space-y-4">
                <div className="relative">
                  <img
                    src={photoUrl}
                    alt="Foto capturada"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={onRequestLocation} className="flex-1">
                    Continuar
                  </Button>
                  <Button variant="outline" onClick={onRetryPhoto}>
                    Repetir
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-danger/10 border border-danger/20 rounded-md p-2">
                <p className="text-danger text-sm">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Paso 2: Ubicación */}
      {cameraStep === 'location' && (
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-ok/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPinIcon className="h-8 w-8 text-ok" />
            </div>
            <CardTitle className="text-xl">Verificar Ubicación</CardTitle>
            <p className="text-dim">Confirma tu ubicación actual</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <UserIcon className="h-5 w-5 text-dim" />
                <span className="font-medium">
                  {employee?.firstName} {employee?.lastName}
                </span>
              </div>
              <p className="text-sm text-dim mb-4">
                Se requiere tu ubicación para registrar la entrada
              </p>
            </div>

            <Button
              onClick={onRequestLocation}
              disabled={checkInLoading}
              className="w-full"
            >
              {checkInLoading
                ? 'Obteniendo ubicación...'
                : 'Verificar Ubicación'}
            </Button>

            <Button variant="outline" onClick={onCancel} className="w-full">
              Cancelar
            </Button>

            {error && (
              <div className="bg-danger/10 border border-danger/20 rounded-md p-2">
                <p className="text-danger text-sm">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Paso 3: Confirmación */}
      {cameraStep === 'confirm' && (
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-ok/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="h-8 w-8 text-ok" />
            </div>
            <CardTitle className="text-xl">Confirmar Registro</CardTitle>
            <p className="text-dim">Revisa la información antes de confirmar</p>
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
                <span className="text-sm font-medium text-dim">Hora:</span>
                <span className="font-medium">{formatTime(new Date())}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-dim">Estado:</span>
                <Badge className="bg-ok/15 text-ok">Presente</Badge>
              </div>

              {location && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-dim">
                    Ubicación:
                  </span>
                  <span className="text-sm text-ok">✓ Verificada</span>
                </div>
              )}
            </div>

            <Button
              onClick={onConfirmCheckIn}
              disabled={checkInLoading}
              className="w-full"
            >
              {checkInLoading ? 'Registrando...' : 'Confirmar Entrada'}
            </Button>

            <Button variant="outline" onClick={onCancel} className="w-full">
              Cancelar
            </Button>

            {error && (
              <div className="bg-danger/10 border border-danger/20 rounded-md p-2">
                <p className="text-danger text-sm">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </Modal>
  );
};
