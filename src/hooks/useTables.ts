import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, tokenDeSesion } from '@/services/api/apiClient';
import { TableStatusEnum } from '@/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface Table {
  id: string;
  name: string;
  number: number;
  status: TableStatusEnum;
  isAvailable: boolean;
  orderId?: string | null;
  capacity: number;
  createdAt: Date;
  updatedAt?: Date;
}

export const tableKeys = {
  all: ['tables'] as const,
  lists: () => [...tableKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...tableKeys.lists(), filters] as const,
  details: () => [...tableKeys.all, 'detail'] as const,
  detail: (id: string) => [...tableKeys.details(), id] as const,
};

export function useTables(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: tableKeys.list(filters),
    queryFn: () =>
      api.get<Table[]>('/api/tables', filters as Record<string, string>),
  });
}

export function useTable(id: string) {
  return useQuery({
    queryKey: tableKeys.detail(id),
    queryFn: () => api.get<Table>(`/api/tables/${id}`),
    enabled: !!id,
  });
}

export function useCreateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Table>) => api.post<Table>('/api/tables', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tableKeys.lists() });
    },
  });
}

export function useUpdateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Table> }) =>
      api.patch<Table>(`/api/tables/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: tableKeys.lists() });
      qc.invalidateQueries({ queryKey: tableKeys.detail(id) });
    },
  });
}

export function useClaimTable() {
  return useMutation({
    mutationFn: ({
      tableId,
      waiterId,
      waiterName,
    }: {
      tableId: string;
      waiterId: string;
      waiterName?: string;
    }) =>
      api.post<Table>(`/api/tables/${tableId}/claim`, {
        waiterId,
        waiterName,
      }),
  });
}

export function useReleaseTable() {
  return useMutation({
    mutationFn: ({
      tableId,
      waiterId,
    }: {
      tableId: string;
      waiterId: string;
    }) => api.post<Table>(`/api/tables/${tableId}/release`, { waiterId }),
  });
}

export async function heartbeatTable(tableId: string, waiterId: string) {
  try {
    await api.post(`/api/tables/${tableId}/heartbeat`, { waiterId });
  } catch (err) {
    // Silenciar: heartbeat es best-effort. Si la mesa ya no es suya, el
    // backend responde pero no rompemos el flujo del usuario.
    console.warn('[heartbeatTable] error (ignorado):', err);
  }
}

/**
 * Token para liberar la mesa al salir. Se pide UNA vez al entrar y se guarda,
 * porque en `pagehide` ya no da tiempo de resolver una promesa.
 */
export async function getReleaseToken(): Promise<string | null> {
  try {
    return (await tokenDeSesion()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Libera la mesa de forma que sobreviva al cierre de la pestaña o a una
 * navegacion dura.
 *
 * `keepalive` deja que la peticion se complete aunque el documento muera; una
 * mutacion normal se cancela y la mesa queda roja hasta que el barrido del
 * backend la suelte. No se usa `sendBeacon` porque no permite mandar el
 * header Authorization. Es best-effort: si falla, el barrido es la red de
 * seguridad.
 */
export function releaseTableOnExit(
  tableId: string,
  waiterId: string,
  token: string | null,
): void {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    void fetch(`${API_BASE_URL}/api/tables/${tableId}/release`, {
      method: 'POST',
      keepalive: true,
      headers,
      body: JSON.stringify({ waiterId }),
    }).catch(() => {
      /* best-effort: el barrido del backend la libera igual */
    });
  } catch {
    /* best-effort */
  }
}

export function useUpdateTableStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TableStatusEnum }) =>
      api.patch<Table>(`/api/tables/${id}`, { status }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: tableKeys.lists() });
      qc.invalidateQueries({ queryKey: tableKeys.detail(id) });
    },
  });
}

export function useDeleteTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/tables/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tableKeys.lists() });
    },
  });
}
