import { useState } from 'react';
import { Employee } from '@odin6/types';
import { Attendance } from '@odin6/types';
import { useToast } from '@/components/hooks/useToast';
import { uploadAttendancePhoto } from '@/services/uploads/uploadImage';
import { useCheckout } from '@/hooks';

export type CheckoutStep =
  | 'auth'
  | 'review'
  | 'camera'
  | 'preview'
  | 'confirm'
  | 'success';

export interface UseCheckoutFlowReturn {
  step: CheckoutStep;
  notes: string;
  loading: boolean;
  setStep: (step: CheckoutStep) => void;
  setNotes: (notes: string) => void;
  confirmCheckOut: (
    employee: Employee | null,
    todayAttendance: Attendance | null,
    photoBlob: Blob | null,
  ) => Promise<void>;
  cleanup: () => void;
}

/**
 * Hook para manejar el flujo general de checkout
 */
export const useCheckoutFlow = (): UseCheckoutFlowReturn => {
  const toast = useToast();
  const [step, setStep] = useState<CheckoutStep>('auth');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const checkout = useCheckout();

  const confirmCheckOut = async (
    employee: Employee | null,
    todayAttendance: Attendance | null,
    photoBlob: Blob | null,
  ): Promise<void> => {
    if (!employee || !todayAttendance || !photoBlob) {
      toast.error({
        title: 'Información incompleta',
        description:
          'Faltan datos para completar el registro (incluida la foto)',
      });
      return;
    }

    try {
      setLoading(true);

      // Subir la foto a la API
      await uploadAttendancePhoto(photoBlob, employee.id);

      // Usar checkout mutation
      checkout.mutate(employee.id, {
        onSuccess: () => {
          setStep('success');
          toast.success({
            title: '¡Salida registrada!',
            description: 'Tu salida ha sido registrada exitosamente',
          });
        },
        onError: () => {
          toast.error({
            title: 'Error al registrar',
            description: 'No se pudo registrar la salida. Intenta nuevamente.',
          });
        },
      });
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error({
        title: 'Error al procesar',
        description: 'Error al procesar la foto. Intenta nuevamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  const cleanup = (): void => {
    setStep('auth');
    setNotes('');
  };

  return {
    step,
    notes,
    loading,
    setStep,
    setNotes,
    confirmCheckOut,
    cleanup,
  };
};
