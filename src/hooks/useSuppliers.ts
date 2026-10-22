import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { Supplier } from '@odin6/types';

export const supplierKeys = {
  all: ['suppliers'] as const,
  lists: () => [...supplierKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...supplierKeys.lists(), filters] as const,
  details: () => [...supplierKeys.all, 'detail'] as const,
  detail: (id: string) => [...supplierKeys.details(), id] as const,
};

export function useSuppliers(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: supplierKeys.list(filters),
    queryFn: () =>
      api.get<Supplier[]>('/api/suppliers', filters as Record<string, string>),
  });
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: supplierKeys.detail(id),
    queryFn: () => api.get<Supplier>(`/api/suppliers/${id}`),
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Supplier>) =>
      api.post<Supplier>('/api/suppliers', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supplierKeys.lists() });
    },
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Supplier> }) =>
      api.patch<Supplier>(`/api/suppliers/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: supplierKeys.lists() });
      qc.invalidateQueries({ queryKey: supplierKeys.detail(id) });
    },
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/suppliers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supplierKeys.lists() });
    },
  });
}

export function useAddProductToSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      supplierId,
      productId,
    }: {
      supplierId: string;
      productId: string;
    }) => api.post(`/api/suppliers/${supplierId}/products/${productId}`, {}),
    onSuccess: (_, { supplierId }) => {
      qc.invalidateQueries({ queryKey: supplierKeys.detail(supplierId) });
      qc.invalidateQueries({ queryKey: supplierKeys.lists() });
    },
  });
}

export function useRemoveProductFromSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      supplierId,
      productId,
    }: {
      supplierId: string;
      productId: string;
    }) => api.del(`/api/suppliers/${supplierId}/products/${productId}`),
    onSuccess: (_, { supplierId }) => {
      qc.invalidateQueries({ queryKey: supplierKeys.detail(supplierId) });
      qc.invalidateQueries({ queryKey: supplierKeys.lists() });
    },
  });
}
