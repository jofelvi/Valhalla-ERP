import { useState } from 'react';
import { Employee } from '@odin6/types';
import { Attendance } from '@odin6/types';
import { useEmployee, useAttendanceByEmployee } from '@/hooks';
import { useToast } from '@/components/hooks/useToast';

export interface UseAuthCheckoutReturn {
  employeeId: string;
  pin: string;
  employee: Employee | null;
  todayAttendance: Attendance | null;
  loading: boolean;
  setEmployeeId: (id: string) => void;
  setPin: (pin: string) => void;
  authenticate: () => Promise<void>;
  reset: () => void;
}

/**
 * Hook para manejar la autenticación del empleado y validaciones
 */
export const useAuthCheckout = (): UseAuthCheckoutReturn => {
  const toast = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  // React Query hooks
  const { data: employeeData } = useEmployee(employeeId);
  const { data: attendancesByEmployee = [] } =
    useAttendanceByEmployee(employeeId);

  const authenticate = async (): Promise<void> => {
    if (!employeeId || !pin) {
      toast.error({
        title: 'Error de Validación',
        description: 'Por favor ingresa tu ID de empleado y PIN',
      });
      return;
    }

    try {
      setLoading(true);

      // Verificar que el empleado exista
      if (!employeeData) {
        toast.error({
          title: 'Empleado no encontrado',
          description: 'Verifica que el ID sea correcto',
        });
        return;
      }

      // Verificar PIN
      if (employeeData.pin && employeeData.pin !== pin) {
        toast.error({
          title: 'PIN incorrecto',
          description: 'Verifica tu PIN de seguridad',
        });
        return;
      }

      // Verificar que el empleado esté activo
      if (!employeeData.isActive) {
        toast.error({
          title: 'Empleado inactivo',
          description: 'Contacta a recursos humanos',
        });
        return;
      }

      // Obtener el registro de asistencia de hoy
      const today = new Date();
      const todayAttendanceRecord = attendancesByEmployee.find(
        (att) => new Date(att.date).toDateString() === today.toDateString(),
      );

      if (!todayAttendanceRecord) {
        toast.error({
          title: 'Sin registro de entrada',
          description: 'No se encontró registro de entrada para hoy',
        });
        return;
      }

      setEmployee(employeeData);
      setTodayAttendance(todayAttendanceRecord);
      toast.success({
        title: 'Identidad verificada',
        description: `Bienvenido ${employeeData.firstName}`,
      });
    } catch {
      toast.error({
        title: 'Error de conexión',
        description: 'Error al verificar credenciales',
      });
    } finally {
      setLoading(false);
    }
  };

  const reset = (): void => {
    setEmployeeId('');
    setPin('');
    setEmployee(null);
    setTodayAttendance(null);
  };

  return {
    employeeId,
    pin,
    employee,
    todayAttendance,
    loading,
    setEmployeeId,
    setPin,
    authenticate,
    reset,
  };
};
