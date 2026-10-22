'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getRouteParam } from '@/shared/utils/routeParams';
import { useEmployee } from '@/hooks/useEmployees';
import { useAttendanceByEmployee, useCheckout } from '@/hooks/useAttendance';
import {
  AttendanceHeader,
  AttendanceFilters,
  AttendanceSummary,
  AttendanceHistory,
  CheckInModal,
  AttendanceFormModal,
} from './components';
import { useCheckInFlow, useAttendanceFilters } from './hooks';

/**
 * Página de asistencias de un empleado
 * Orquestador delgado que coordina componentes, hooks y lógica
 */
export default function EmployeeAttendancePage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = getRouteParam(params.id);
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [checkOutError, setCheckOutError] = useState<string | null>(null);
  const [checkOutLoading, setCheckOutLoading] = useState(false);

  // Data hooks
  const { data: employee, isLoading: employeeLoading } =
    useEmployee(employeeId);
  const { data: allAttendances = [], isLoading: attendancesLoading } =
    useAttendanceByEmployee(employeeId);
  const checkoutMutation = useCheckout();

  // Check-in flow hook
  const checkInFlow = useCheckInFlow();

  // Attendance filters hook
  const {
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    filteredAttendances,
    monthStats,
    todayAttendance,
  } = useAttendanceFilters(allAttendances);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (checkInFlow.cameraStream) {
        checkInFlow.cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [checkInFlow.cameraStream]);

  // Manejar validaciones antes de iniciar check-in
  const handleCheckInStart = () => {
    if (!employee) return;

    // Validar que no hay un check-in activo sin check-out
    if (todayAttendance && !todayAttendance.checkOut) {
      checkInFlow.setError(
        'Ya tienes una entrada registrada hoy. Debes registrar tu salida antes de hacer otra entrada.',
      );
      return;
    }

    checkInFlow.setShowCheckInModal(true);
  };

  // Manejar checkout
  const handleCheckOut = async () => {
    if (!employee) return;

    try {
      setCheckOutLoading(true);
      setCheckOutError(null);
      await checkoutMutation.mutateAsync(employee.id);
    } catch {
      setCheckOutError('Error al registrar salida');
      console.error('Error registering check-out');
    } finally {
      setCheckOutLoading(false);
    }
  };

  // Manejar confirmación de check-in
  const handleConfirmCheckIn = async () => {
    if (!employee) return;
    await checkInFlow.confirmCheckIn(employee.id);
  };

  // Volver
  const handleBack = () => {
    router.push(`/private/employees/${employee?.id}`);
  };

  // Refrescar asistencias al completar formulario manual
  const handleAttendanceFormSuccess = () => {
    setShowAttendanceForm(false);
  };

  if (employeeLoading && !employee) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con botones de acción */}
      <AttendanceHeader
        employee={employee}
        todayAttendance={todayAttendance}
        onBack={handleBack}
        onManualRecord={() => setShowAttendanceForm(true)}
        onCheckIn={handleCheckInStart}
        onCheckOut={handleCheckOut}
        checkOutLoading={checkOutLoading}
      />

      {/* Mensaje de error general */}
      {checkOutError && (
        <div className="bg-danger/10 border border-danger/20 rounded-md p-4">
          <p className="text-danger">{checkOutError}</p>
        </div>
      )}

      {/* Grid de filtros, resumen y estado */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AttendanceFilters
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
        />

        <AttendanceSummary
          monthStats={monthStats}
          todayAttendance={todayAttendance}
        />
      </div>

      {/* Historial de asistencias */}
      <AttendanceHistory
        filteredAttendances={filteredAttendances}
        isLoading={attendancesLoading}
      />

      {/* Modal de registro manual */}
      <AttendanceFormModal
        isOpen={showAttendanceForm}
        employee={employee}
        onClose={() => setShowAttendanceForm(false)}
        onSuccess={handleAttendanceFormSuccess}
      />

      {/* Modal de check-in */}
      <CheckInModal
        isOpen={checkInFlow.showCheckInModal}
        employee={employee}
        cameraStep={checkInFlow.cameraStep}
        photoUrl={checkInFlow.photoUrl}
        cameraStream={checkInFlow.cameraStream}
        location={checkInFlow.location}
        error={checkInFlow.error}
        checkInLoading={checkInFlow.checkInLoading}
        videoRef={checkInFlow.videoRef}
        onClose={() => checkInFlow.setShowCheckInModal(false)}
        onStartCamera={checkInFlow.startCamera}
        onCapturePhoto={checkInFlow.capturePhoto}
        onRetryPhoto={checkInFlow.retryPhoto}
        onRequestLocation={checkInFlow.requestLocation}
        onConfirmCheckIn={handleConfirmCheckIn}
        onCancel={checkInFlow.cancelCheckIn}
      />
    </div>
  );
}
