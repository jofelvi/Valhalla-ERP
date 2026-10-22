'use client';
import Modal from '@/components/shared/modal';
import AttendanceForm from '@/features/attendance/AttendanceForm';
import { Employee } from '@odin6/types';

interface AttendanceFormModalProps {
  isOpen: boolean;
  employee: Employee | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal con el formulario de registro manual de asistencias
 */
export const AttendanceFormModal = ({
  isOpen,
  employee,
  onClose,
  onSuccess,
}: AttendanceFormModalProps) => {
  if (!employee) return null;

  return (
    <Modal
      isOpen={isOpen}
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black"
      classNameWrap="p-4"
      className="bg-surface rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
    >
      <AttendanceForm
        employeeId={employee.id}
        employeeName={`${employee.firstName} ${employee.lastName}`}
        onSuccess={onSuccess}
        onCancel={onClose}
      />
    </Modal>
  );
};
