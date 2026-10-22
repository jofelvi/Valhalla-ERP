import { useCallback, useRef, useState } from 'react';
import { useCheckin } from '@/hooks/useAttendance';

export type CameraStep = 'camera' | 'location' | 'confirm';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export const useCheckInFlow = () => {
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [cameraStep, setCameraStep] = useState<CameraStep>('camera');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const checkinMutation = useCheckin();

  // Detener stream de cámara cuando se desmonta o cuando se limpia
  const stopCameraStream = useCallback((stream: MediaStream | null) => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  }, []);

  // Limpiar URL de foto
  const cleanupPhotoUrl = useCallback((url: string | null) => {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }, []);

  // Iniciar cámara
  const startCamera = useCallback(async () => {
    try {
      setCheckInLoading(true);
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });

      setCameraStream(stream);
      // Asignar stream al elemento video
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
      console.error('Error accessing camera');
    } finally {
      setCheckInLoading(false);
    }
  }, []);

  // Capturar foto desde video
  const capturePhoto = useCallback(async () => {
    try {
      const video = videoRef.current;

      if (!video) {
        throw new Error('No se encontró el elemento de video');
      }

      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        throw new Error('El video no está listo para capturar');
      }

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error('Las dimensiones del video no son válidas');
      }

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('No se pudo crear el contexto del canvas');
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      // Convertir a blob

      canvas.toBlob(
        (blob) => {
          if (blob) {
            setPhotoUrl(URL.createObjectURL(blob));

            // Detener cámara
            stopCameraStream(cameraStream);
            setCameraStream(null);

            setCameraStep('location');
          } else {
            setError('No se pudo generar la imagen. Intenta nuevamente.');
          }
        },
        'image/jpeg',
        0.8,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al capturar foto: ${message}`);
      console.error('Error capturing photo:', err);
    }
  }, [cameraStream, stopCameraStream]);

  // Solicitar ubicación
  const requestLocation = useCallback(async () => {
    try {
      setCheckInLoading(true);
      setError(null);

      if (!navigator.geolocation) {
        setError('Tu dispositivo no soporta geolocalización');
        return;
      }

      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        },
      );

      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      setLocation(locationData);
      setCameraStep('confirm');
    } catch {
      setError('No se pudo obtener tu ubicación. Verifica los permisos.');
      console.error('Error requesting location');
    } finally {
      setCheckInLoading(false);
    }
  }, []);

  // Confirmar check-in
  const confirmCheckIn = useCallback(
    async (employeeId: string) => {
      if (!location) {
        setError('Faltan datos para completar el registro');
        return;
      }

      try {
        setCheckInLoading(true);
        await checkinMutation.mutateAsync(employeeId);

        // Limpiar estado
        setShowCheckInModal(false);
        setCameraStep('camera');
        cleanupPhotoUrl(photoUrl);
        setPhotoUrl(null);
        setLocation(null);
        setError(null);

        // Mensaje de éxito
        setTimeout(() => {
          alert('¡Entrada registrada exitosamente!');
        }, 100);
      } catch (err) {
        setError('Error al registrar entrada. Intenta nuevamente.');
        console.error('Error registering check-in:', err);
      } finally {
        setCheckInLoading(false);
      }
    },
    [location, checkinMutation, photoUrl, cleanupPhotoUrl],
  );

  // Cancelar check-in
  const cancelCheckIn = useCallback(() => {
    stopCameraStream(cameraStream);
    setCameraStream(null);
    cleanupPhotoUrl(photoUrl);
    setPhotoUrl(null);
    setShowCheckInModal(false);
    setCameraStep('camera');
    setLocation(null);
    setError(null);
  }, [cameraStream, photoUrl, stopCameraStream, cleanupPhotoUrl]);

  // Reintentar foto (volver a cámara)
  const retryPhoto = useCallback(() => {
    cleanupPhotoUrl(photoUrl);
    setPhotoUrl(null);
    startCamera();
  }, [photoUrl, cleanupPhotoUrl, startCamera]);

  return {
    // Estado
    showCheckInModal,
    cameraStep,
    photoUrl,
    cameraStream,
    location,
    checkInLoading,
    error,
    videoRef,

    // Controles
    setShowCheckInModal,
    setCameraStep,
    setError,

    // Acciones
    startCamera,
    capturePhoto,
    requestLocation,
    confirmCheckIn,
    cancelCheckIn,
    retryPhoto,
  };
};
