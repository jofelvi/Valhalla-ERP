import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { Employee } from '@odin6/types';

export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...employeeKeys.lists(), filters] as const,
  details: () => [...employeeKeys.all, 'detail'] as const,
  detail: (id: string) => [...employeeKeys.details(), id] as const,
  active: () => [...employeeKeys.all, 'active'] as const,
};

export function useEmployees(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: employeeKeys.list(filters),
    queryFn: () =>
      api.get<Employee[]>('/api/employees', filters as Record<string, string>),
  });
}

export function useActiveEmployees() {
  return useQuery({
    queryKey: employeeKeys.active(),
    // El controller lee el query param `active` (no `isActive`).
    queryFn: () =>
      api.get<Employee[]>('/api/employees', { active: 'true' } as Record<
        string,
        string
      >),
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => api.get<Employee>(`/api/employees/${id}`),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Employee>) =>
      api.post<Employee>('/api/employees', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.lists() });
      qc.invalidateQueries({ queryKey: employeeKeys.active() });
    },
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Employee> }) =>
      api.patch<Employee>(`/api/employees/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: employeeKeys.lists() });
      qc.invalidateQueries({ queryKey: employeeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: employeeKeys.active() });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/employees/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.lists() });
      qc.invalidateQueries({ queryKey: employeeKeys.active() });
    },
  });
}
