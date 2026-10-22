import { useState } from 'react';
import { useToast } from '@/components/hooks/useToast';

export interface UseCameraCaptureReturn {
  photoBlob: Blob | null;
  photoUrl: string | null;
  cameraStream: MediaStream | null;
  loading: boolean;
  startCamera: () => Promise<void>;
  capturePhoto: () => void;
  cleanup: () => void;
  resetPhoto: () => void;
}

/**
 * Hook para manejar la captura de cámara
 */
export const useCameraCapture = (): UseCameraCaptureReturn => {
  const toast = useToast();
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);

  const startCamera = async (): Promise<void> => {
    try {
      setLoading(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });

      setCameraStream(stream);

      // Configurar video en el DOM
      setTimeout(() => {
        const video = document.getElementById(
          'camera-video',
        ) as HTMLVideoElement | null;
        if (video) {
          video.srcObject = stream;
        }
      }, 100);
    } catch (error) {
      console.error('Error accediendo a la cámara:', error);
      toast.error({
        title: 'Error de cámara',
        description: 'No se pudo acceder a la cámara. Verifica los permisos',
      });
    } finally {
      setLoading(false);
    }
  };

  const capturePhoto = (): void => {
    try {
      const video = document.getElementById(
        'camera-video',
      ) as HTMLVideoElement | null;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!video || !context) {
        toast.error({
          title: 'Error de captura',
          description: 'Error al acceder al video',
        });
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
          }
        },
        'image/jpeg',
        0.8,
      );
    } catch (error) {
      console.error('Error capturando foto:', error);
      toast.error({
        title: 'Error de captura',
        description: 'Error al tomar la foto',
      });
    }
  };

  const cleanup = (): void => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
      setPhotoUrl(null);
    }
  };

  const resetPhoto = (): void => {
    setPhotoBlob(null);
    setPhotoUrl(null);
    cleanup();
  };

  return {
    photoBlob,
    photoUrl,
    cameraStream,
    loading,
    startCamera,
    capturePhoto,
    cleanup,
    resetPhoto,
  };
};
