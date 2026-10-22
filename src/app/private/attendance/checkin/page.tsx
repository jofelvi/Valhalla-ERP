'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Employee } from '@odin6/types';
import { uploadAttendancePhoto } from '@/services/uploads/uploadImage';
import { useEmployees, useAttendance, useCheckin } from '@/hooks';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CameraIcon,
  CheckCircleIcon,
} from 'lucide-react';

type Step = 'login' | 'camera' | 'preview' | 'success';

export default function CheckInPage() {
  const router = useRouter();
  const { data: employees = [] } = useEmployees();
  // Solo baja entradas abiertas (sin checkOut) para verificar si el empleado
  // ya tiene una entrada activa. 76 KB de histórico completo se reduce a ~1 KB
  // cuando no hay entradas activas. Parámetro onlyOpenEntries es OPT-IN:
  // sin él, el endpoint devuelve todo (backward compatible con otros consumidores).
  const { data: attendances = [] } = useAttendance({
    onlyOpenEntries: true,
  });
  const checkin = useCheckin();

  // State
  const [step, setStep] = useState<Step>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [employee, setEmployee] = useState<Employee | null>(null);

  // Camera data
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Find employee by email (memoized)
  const employeeByEmail = useMemo(() => {
    if (!email.trim()) return null;
    return employees.find((e) => e.email.toLowerCase() === email.toLowerCase());
  }, [employees, email]);

  // 1. LOGIN - Verificar empleado y validar entrada activa
  const handleLogin = async () => {
    if (!email || !pin) {
      setError('Por favor ingresa tu email y PIN');
      return;
    }

    try {
      setError(null);

      const employeeData = employeeByEmail;
      if (!employeeData) {
        setError('Empleado no encontrado');
        return;
      }

      // Verificar PIN
      if (employeeData.pin !== pin) {
        setError('PIN incorrecto');
        return;
      }

      // Verificar que esté activo
      if (!employeeData.isActive) {
        setError('Empleado inactivo. Contacta a recursos humanos');
        return;
      }

      // VALIDACIÓN CLAVE: Verificar que no tenga entrada activa
      const employeeAttendances = attendances.filter(
        (a) => a.employeeId === employeeData.id,
      );
      const activeEntry = employeeAttendances.find(
        (a) => a.checkIn && !a.checkOut,
      );

      if (activeEntry) {
        setError('Ya tienes una entrada activa. Debes hacer check-out primero');
        return;
      }

      setEmployee(employeeData);
      setStep('camera');
    } catch (err) {
      console.error('Error en login:', err);
      setError('Error al verificar credenciales');
    }
  };

  // 2. CAMERA - Activar cámara
  const startCamera = async () => {
    try {
      setLoading(true);
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });

      setCameraStream(stream);

      // Configurar video
      setTimeout(() => {
        const video = document.getElementById(
          'camera-video',
        ) as HTMLVideoElement;
        if (video) {
          video.srcObject = stream;
        }
      }, 100);
    } catch (error) {
      console.error('Error accediendo a la cámara:', error);
      setError('No se pudo acceder a la cámara. Verifica los permisos');
    } finally {
      setLoading(false);
    }
  };

  // 3. CAPTURE - Capturar foto
  const capturePhoto = () => {
    try {
      const video = document.getElementById('camera-video') as HTMLVideoElement;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!video || !context) {
        setError('Error al acceder al video');
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            setPhotoBlob(blob);
            setPhotoUrl(URL.createObjectURL(blob));

            // Detener cámara
            if (cameraStream) {
              cameraStream.getTracks().forEach((track) => track.stop());
              setCameraStream(null);
            }

            setStep('preview');
          }
        },
        'image/jpeg',
        0.8,
      );
    } catch (error) {
      console.error('Error capturando foto:', error);
      setError('Error al tomar la foto');
    }
  };

  // 4. CONFIRM - Confirmar y registrar entrada
  const confirmCheckIn = async () => {
    if (!employee || !photoBlob) {
      setError('Faltan datos para completar el registro');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Subir la foto a la API (se guarda en el disco del VPS)
      await uploadAttendancePhoto(photoBlob, employee.id);

      // Register check-in using mutation
      checkin.mutate(employee.id, {
        onSuccess: () => {
          setStep('success');
        },
        onError: () => {
          setError('Error al registrar la entrada. Intenta nuevamente');
        },
      });
    } catch (error) {
      console.error('Error registrando entrada:', error);
      setError('Error al procesar la foto. Intenta nuevamente');
    } finally {
      setLoading(false);
    }
  };

  // Limpiar recursos
  const cleanup = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
      setPhotoUrl(null);
    }
  };

  // Reset para nueva entrada
  const resetForm = () => {
    cleanup();
    setStep('login');
    setEmail('');
    setPin('');
    setEmployee(null);
    setPhotoBlob(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-page to-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* ERROR ALERT */}
        {error && (
          <Card className="mb-4 border-danger/30 bg-danger/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-danger">
                <AlertCircleIcon className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 1: LOGIN */}
        {step === 'login' && (
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Check-In</CardTitle>
              <p className="text-dim">Ingresa tus credenciales</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu-email@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="pin">PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  placeholder="Tu PIN de seguridad"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </div>

              <Button
                onClick={handleLogin}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Verificando...' : 'Iniciar Sesión'}
              </Button>

              <Button
                variant="ghost"
                onClick={() => router.push('/private/employees')}
                className="w-full"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: CAMERA */}
        {step === 'camera' && (
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CameraIcon className="h-8 w-8 text-accent" />
              </div>
              <CardTitle className="text-xl">Foto Obligatoria</CardTitle>
              <p className="text-dim">
                {employee?.firstName} {employee?.lastName}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!cameraStream && (
                <div className="text-center">
                  <p className="text-sm text-dim mb-4">
                    Es obligatorio tomar una foto para registrar tu entrada
                  </p>
                  <Button
                    onClick={startCamera}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? 'Iniciando cámara...' : 'Activar Cámara'}
                  </Button>
                </div>
              )}

              {cameraStream && (
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
                    <Button onClick={capturePhoto} className="flex-1">
                      <CameraIcon className="h-4 w-4 mr-2" />
                      Tomar Foto
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        cleanup();
                        setStep('login');
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 3: PREVIEW */}
        {step === 'preview' && photoUrl && (
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Confirmar Foto</CardTitle>
              <p className="text-dim">
                {employee?.firstName} {employee?.lastName}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <img
                  src={photoUrl}
                  alt="Foto capturada"
                  className="w-full h-64 object-cover rounded-lg mb-4"
                />

                <div className="bg-elevated rounded-lg p-4 mb-4">
                  <div className="text-sm text-dim">
                    <p>
                      <strong>Empleado:</strong> {employee?.firstName}{' '}
                      {employee?.lastName}
                    </p>
                    <p>
                      <strong>Fecha:</strong>{' '}
                      {new Date().toLocaleDateString('es-ES')}
                    </p>
                    <p>
                      <strong>Hora:</strong>{' '}
                      {new Date().toLocaleTimeString('es-ES')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={confirmCheckIn}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Registrando...' : 'Confirmar Check-In'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    cleanup();
                    setStep('camera');
                  }}
                >
                  Repetir Foto
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4: SUCCESS */}
        {step === 'success' && (
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-ok/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircleIcon className="h-8 w-8 text-ok" />
              </div>
              <CardTitle className="text-2xl text-ok">
                ¡Check-In Registrado!
              </CardTitle>
              <p className="text-dim">
                Tu entrada ha sido registrada exitosamente
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-ok/10 rounded-lg p-4 text-center">
                <p className="text-lg font-semibold">
                  {employee?.firstName} {employee?.lastName}
                </p>
                <p className="text-sm text-dim">
                  {new Date().toLocaleDateString('es-ES')}
                </p>
                <p className="text-2xl font-bold text-ok">
                  {new Date().toLocaleTimeString('es-ES')}
                </p>
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
                  onClick={resetForm}
                  className="w-full"
                >
                  Nuevo Check-In
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
