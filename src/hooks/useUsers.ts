import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { User } from '@odin6/types';

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  active: () => [...userKeys.all, 'active'] as const,
  waiters: () => [...userKeys.all, 'waiters'] as const,
};

export function useUsers(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: () =>
      api.get<User[]>('/api/users', filters as Record<string, string>),
  });
}

/**
 * Solo los mesoneros activos: id y nombre.
 *
 * `GET /api/users` es `@Roles(ADMIN)`. Las pantallas que solo necesitan saber
 * quien atendio —el recibo, la pantalla de cobro, la de tomar el pedido, la
 * lista de ordenes— lo pedian igual, se comian un 403 y se quedaban con la
 * lista vacia sin decir nada: el ticket salia sin el nombre del mesonero
 * cuando lo imprimia el cajero. Este endpoint existe en la API justo para
 * esto y lo puede llamar cualquier staff autenticado.
 */
export function useWaiters() {
  return useQuery({
    queryKey: userKeys.waiters(),
    queryFn: () =>
      api.get<{ id: string; name: string }[]>('/api/users/waiters'),
  });
}

export function useActiveUsers() {
  return useQuery({
    queryKey: userKeys.active(),
    queryFn: () => api.get<User[]>('/api/users', { isActive: true }),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => api.get<User>(`/api/users/${id}`),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<User>) => api.post<User>('/api/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      qc.invalidateQueries({ queryKey: userKeys.active() });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) =>
      api.patch<User>(`/api/users/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      qc.invalidateQueries({ queryKey: userKeys.detail(id) });
      qc.invalidateQueries({ queryKey: userKeys.active() });
    },
  });
}

/**
 * Resetea la contraseña de un usuario (accion de admin).
 *
 * Ruta propia `/password`: mandarla en el PATCH normal no sirve, porque el
 * ValidationPipe del backend descarta en silencio los campos que no estan en
 * UpdateUserDto y la clave se perderia sin dar error.
 */
export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      api.patch<{ success: boolean; email?: string }>(
        `/api/users/${id}/password`,
        { newPassword },
      ),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      qc.invalidateQueries({ queryKey: userKeys.active() });
    },
  });
}
