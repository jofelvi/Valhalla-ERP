import { useParams, useRouter } from 'next/navigation';
import { useEmployee } from '@/hooks/useEmployees';
import { useState } from 'react';

export const useEmployeeDetail = () => {
  const params = useParams();
  const router = useRouter();
  const { id: employeeId } = params;
  const { data: employee = null, isLoading } = useEmployee(
    typeof employeeId === 'string' ? employeeId : '',
  );
  const [error, setError] = useState<string | null>(null);

  const handleBack = () => {
    router.push('/private/employees');
  };

  const handleEdit = () => {
    router.push(`/private/employees/${employee?.id}/edit`);
  };

  return {
    employee,
    isLoading,
    error,
    setError,
    handleBack,
    handleEdit,
  };
};
