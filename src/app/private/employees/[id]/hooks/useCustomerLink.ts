import { useState } from 'react';
import { useSearchCustomers } from '@/hooks/useCustomers';
import { useUpdateEmployee, employeeKeys } from '@/hooks/useEmployees';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';

export const useCustomerLink = () => {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  // Busca en el servidor (`/api/customers/search`, tope 50) en vez de bajarse
  // el padron entero para filtrarlo con un `.includes()`. El endpoint exige 3
  // letras; el modal lo dice en pantalla.
  const { data: customers = [], isFetching: buscandoClientes } =
    useSearchCustomers(customerSearch);
  const updateEmployee = useUpdateEmployee();
  const queryClient = useQueryClient();

  const handleLinkCustomer = async (employeeId: string, customerId: string) => {
    await updateEmployee.mutateAsync({
      id: employeeId,
      data: { customerId },
    });
    setShowLinkModal(false);
    setCustomerSearch('');
  };

  const handleUnlinkCustomer = async (employeeId: string) => {
    await api.patch(`/api/employees/${employeeId}`, {
      customerId: null,
    });
    queryClient.invalidateQueries({
      queryKey: employeeKeys.lists(),
    });
    queryClient.invalidateQueries({
      queryKey: employeeKeys.detail(employeeId),
    });
    queryClient.invalidateQueries({
      queryKey: employeeKeys.active(),
    });
    setShowLinkModal(false);
  };

  return {
    showLinkModal,
    setShowLinkModal,
    customerSearch,
    setCustomerSearch,
    customers,
    buscandoClientes,
    handleLinkCustomer,
    handleUnlinkCustomer,
  };
};
