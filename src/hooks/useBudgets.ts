import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { Budget, CalendarEvent, AcceptBudgetPayload } from '@odin6/types';

export const budgetKeys = {
  all: ['budgets'] as const,
  lists: () => [...budgetKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...budgetKeys.lists(), filters] as const,
  details: () => [...budgetKeys.all, 'detail'] as const,
  detail: (id: string) => [...budgetKeys.details(), id] as const,
};

export function useBudgets(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: budgetKeys.list(filters),
    queryFn: () =>
      api.get<Budget[]>('/api/budgets', filters as Record<string, string>),
  });
}

export function useBudget(id: string) {
  return useQuery({
    queryKey: budgetKeys.detail(id),
    queryFn: () => api.get<Budget>(`/api/budgets/${id}`),
    enabled: !!id,
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Budget>) =>
      api.post<Budget>('/api/budgets', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.lists() });
    },
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Budget> }) =>
      api.patch<Budget>(`/api/budgets/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: budgetKeys.lists() });
      qc.invalidateQueries({ queryKey: budgetKeys.detail(id) });
    },
  });
}

export function useUpdateBudgetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/budgets/${id}`, { status }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: budgetKeys.lists() });
      qc.invalidateQueries({ queryKey: budgetKeys.detail(id) });
    },
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/budgets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.lists() });
    },
  });
}

export const calendarKeys = {
  all: ['budgets-calendar'] as const,
};

export function useBudgetsCalendar() {
  return useQuery({
    queryKey: calendarKeys.all,
    queryFn: () => api.get<CalendarEvent[]>('/api/budgets/calendar'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAcceptBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AcceptBudgetPayload }) =>
      api.post<Budget & { evtNumber: string }>(
        `/api/budgets/${id}/accept`,
        data,
      ),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: budgetKeys.lists() });
      qc.invalidateQueries({ queryKey: budgetKeys.detail(id) });
      qc.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}
