'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getRouteParam } from '@/shared/utils/routeParams';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon } from 'lucide-react';
import { useEmployee, useUpdateEmployee } from '@/hooks/useEmployees';
import { Employee } from '@odin6/types';
import { EmployeeFormValues } from '@/shared/schemas/employeeSchema';
import EmployeeForm from '@/features/employees/EmployeeForm';
import { uploadFile } from '@/services/uploads/uploadImage';

export default function EditEmployeePage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = getRouteParam(params.id);
  const { data: employee, isLoading: fetchLoading } = useEmployee(employeeId);
  const updateEmployee = useUpdateEmployee();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (employee?.photoUrl) {
      setImagePreview(employee.photoUrl);
    }
  }, [employee?.photoUrl]);

  const onSubmit = async (data: EmployeeFormValues) => {
    try {
      setLoading(true);
      setError(null);

      if (!employee) return;

      let photoUrl = employee.photoUrl ?? null;
      if (imageFile) {
        photoUrl = await uploadFile(imageFile, 'employees');
      } else if (!imagePreview) {
        photoUrl = null;
      }

      const updatedData: Partial<Omit<Employee, 'id'>> = {
        ...data,
        photoUrl,
        updatedAt: new Date(),
        bankAccount: data.bankAccount?.accountNumber ? data.bankAccount : null,
        medicalInfo: data.medicalInfo ?? null,
        observations: data.observations ?? null,
      };

      await updateEmployee.mutateAsync({ id: employee.id, data: updatedData });
      router.push(`/private/employees/${employee.id}`);
    } catch {
      setError('Error al actualizar empleado');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (employee) {
      router.push(`/private/employees/${employee.id}`);
    } else {
      router.push('/private/employees');
    }
  };

  if (fetchLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (fetchLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-8">
        <p className="text-danger">{'Empleado no encontrado'}</p>
        <Button onClick={handleBack} className="mt-4">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Volver
        </Button>
      </div>
    );
  }

  if (employee) {
    return (
      <EmployeeForm
        mode="edit"
        initialData={employee}
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

  return null;
}
