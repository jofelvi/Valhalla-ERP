'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateEmployee } from '@/hooks/useEmployees';
import { EmployeeFormValues } from '@/shared/schemas/employeeSchema';
import { Employee } from '@odin6/types';
import EmployeeForm from '@/features/employees/EmployeeForm';
import { uploadFile } from '@/services/uploads/uploadImage';

export default function NewEmployeePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const router = useRouter();
  const createEmployee = useCreateEmployee();

  const onSubmit = async (data: EmployeeFormValues) => {
    try {
      setLoading(true);
      setError(null);

      let photoUrl: string | null = null;
      if (imageFile) {
        photoUrl = await uploadFile(imageFile, 'employees');
      }

      const employeeData: Omit<Employee, 'id'> = {
        ...data,
        isActive: true,
        photoUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
        bankAccount: data.bankAccount?.accountNumber ? data.bankAccount : null,
        medicalInfo: data.medicalInfo ?? null,
        observations: data.observations ?? null,
      };

      await createEmployee.mutateAsync(employeeData);
      router.push('/private/employees');
    } catch {
      setError('Error al crear empleado');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/private/employees');
  };

  return (
    <EmployeeForm
      mode="create"
      loading={loading}
      error={error}
      onSubmitAction={onSubmit}
      onBackAction={handleBack}
      imageFile={imageFile}
      setImageFile={setImageFile}
      imagePreview={imagePreview}
      setImagePreview={setImagePreview}
    />
  );
}
