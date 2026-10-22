import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { Payroll } from '@odin6/types';

export const payrollKeys = {
  all: ['payroll'] as const,
  lists: () => [...payrollKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...payrollKeys.lists(), filters] as const,
  details: () => [...payrollKeys.all, 'detail'] as const,
  detail: (id: string) => [...payrollKeys.details(), id] as const,
  byEmployee: (employeeId: string) =>
    [...payrollKeys.all, 'employee', employeeId] as const,
  byMonth: (month: number, year: number) =>
    [...payrollKeys.all, 'month', month, year] as const,
};

/** Los filtros viajan por querystring, asi que todo se serializa a texto. */
type PayrollFilters = Record<string, string | undefined>;

export function usePayroll(filters?: PayrollFilters) {
  return useQuery({
    queryKey: payrollKeys.list(filters),
    queryFn: () => api.get<Payroll[]>('/api/payroll', filters),
  });
}

/**
 * Cuantos pagos hay, sin traerselos.
 *
 * La cabecera de /private/payroll solo pinta "N pagos" y para eso se bajaba el
 * historico entero: 194 KB por abrir la pantalla, medidos el 08/09/2026.
 */
export function usePayrollCount(filters?: PayrollFilters) {
  return useQuery({
    queryKey: [...payrollKeys.all, 'count', filters ?? null] as const,
    queryFn: () => api.get<{ total: number }>('/api/payroll/count', filters),
  });
}

export function usePayrollByEmployee(employeeId: string) {
  return useQuery({
    queryKey: payrollKeys.byEmployee(employeeId),
    queryFn: () =>
      api.get<Payroll[]>('/api/payroll', { employeeId } as PayrollFilters),
    enabled: !!employeeId,
  });
}

export function usePayrollByMonth(month: number, year: number) {
  return useQuery({
    queryKey: payrollKeys.byMonth(month, year),
    queryFn: () => api.get<Payroll[]>('/api/payroll', { month, year }),
  });
}

export function usePayrollRecord(id: string) {
  return useQuery({
    queryKey: payrollKeys.detail(id),
    queryFn: () => api.get<Payroll>(`/api/payroll/${id}`),
    enabled: !!id,
  });
}

export function useCreatePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Payroll>) =>
      api.post<Payroll>('/api/payroll', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payrollKeys.lists() });
    },
  });
}

export function useUpdatePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Payroll> }) =>
      api.patch<Payroll>(`/api/payroll/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: payrollKeys.lists() });
      qc.invalidateQueries({ queryKey: payrollKeys.detail(id) });
    },
  });
}

export function useUpdatePayrollStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/payroll/${id}`, { status }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: payrollKeys.lists() });
      qc.invalidateQueries({ queryKey: payrollKeys.detail(id) });
    },
  });
}

export function useDeletePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/payroll/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payrollKeys.lists() });
    },
  });
}
