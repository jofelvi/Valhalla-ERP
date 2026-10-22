import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { EmployeeLoan } from '@odin6/types';

export const loanKeys = {
  all: ['employeeLoans'] as const,
  lists: () => [...loanKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...loanKeys.lists(), filters] as const,
  byEmployee: (employeeId: string) =>
    [...loanKeys.all, 'employee', employeeId] as const,
};

export function useEmployeeLoans(filters?: {
  employeeId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: loanKeys.list(filters),
    queryFn: () =>
      api.get<EmployeeLoan[]>(
        '/api/employee-loans',
        filters as Record<string, string>,
      ),
  });
}

/**
 * Los prestamos vivos de un empleado, sacados de UNA sola consulta compartida.
 *
 * Antes cada fila de la nomina pedia lo suyo (`byEmployee(id)` es una key
 * distinta por persona): 11 `GET /api/employee-loans` en una sola carga de
 * /private/payroll, medido con Playwright. La lista completa de prestamos
 * vivos del negocio pesa unos cientos de bytes, asi que se trae una vez y
 * cada fila filtra con `select` — React Query lo evalua por observador, sin
 * volver a la red.
 */
export function usePendingLoansByEmployee(employeeId: string) {
  return useQuery({
    queryKey: loanKeys.list({ status: 'outstanding' }),
    queryFn: () =>
      api.get<EmployeeLoan[]>('/api/employee-loans', {
        status: 'outstanding',
      }),
    select: (loans) => loans.filter((l) => l.employeeId === employeeId),
    enabled: !!employeeId,
  });
}

export function useCreateEmployeeLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<EmployeeLoan>) =>
      api.post<EmployeeLoan>('/api/employee-loans', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: loanKeys.all });
    },
  });
}

export function useUpdateEmployeeLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EmployeeLoan> }) =>
      api.patch<EmployeeLoan>(`/api/employee-loans/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: loanKeys.all });
    },
  });
}

export function useDeleteEmployeeLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/employee-loans/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: loanKeys.all });
    },
  });
}

interface AbonoPayload {
  amount: number;
  payrollId?: string;
}

interface AbonoResponse {
  applied: number;
}

export function useAbonoEmployeeLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AbonoPayload }) =>
      api.post<EmployeeLoan & AbonoResponse>(
        `/api/employee-loans/${id}/abono`,
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: loanKeys.all });
    },
  });
}
