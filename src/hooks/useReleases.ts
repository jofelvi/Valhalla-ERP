import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import type { Release, ReleaseAmbito } from '@odin6/types';

/**
 * UNA sola familia de keys para este recurso.
 *
 * `useSuppliers` quedo duplicado con dos keys distintas para el mismo endpoint
 * (`['suppliers',...]` en el hook y `['inventory','suppliers']` dentro de
 * useInventory) y por eso crear un proveedor desde una pantalla no refrescaba
 * la otra. Aqui no se repite.
 */
export const releaseKeys = {
  all: ['releases'] as const,
  lists: () => [...releaseKeys.all, 'list'] as const,
  list: (ambito?: ReleaseAmbito) =>
    [...releaseKeys.lists(), ambito ?? 'todos'] as const,
  details: () => [...releaseKeys.all, 'detail'] as const,
  detail: (id: string) => [...releaseKeys.details(), id] as const,
  estado: () => [...releaseKeys.all, 'rollback-estado'] as const,
};

export interface ReversionPorAmbito {
  ambito: ReleaseAmbito;
  reversible: boolean;
  motivo?: string;
}

/** Lo que devuelve el detalle: la entrada mas su veredicto de reversion. */
export interface ReleaseConReversion extends Release {
  reversion: ReversionPorAmbito[];
}

export interface EstadoRollback {
  enCurso: boolean;
  ambito?: ReleaseAmbito;
  sha?: string;
  paso?: string;
  iniciadoEn?: string;
}

export const useReleases = (ambito?: ReleaseAmbito) =>
  useQuery({
    queryKey: releaseKeys.list(ambito),
    queryFn: () =>
      api.get<Release[]>('/api/releases', ambito ? { ambito } : undefined),
  });

export const useRelease = (id: string | null) =>
  useQuery({
    queryKey: releaseKeys.detail(id ?? ''),
    queryFn: () => api.get<ReleaseConReversion>(`/api/releases/${id}`),
    enabled: !!id,
  });

export const useCreateRelease = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Release>) =>
      api.post<Release>('/api/releases', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: releaseKeys.lists() }),
  });
};

export const useUpdateRelease = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Release> }) =>
      api.patch<Release>(`/api/releases/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: releaseKeys.lists() });
      qc.invalidateQueries({ queryKey: releaseKeys.detail(id) });
    },
  });
};

export const useDeleteRelease = () => {
  const qc = useQueryClient();
  return useMutation({
    // El cliente expone `del`, no `delete`.
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/api/releases/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: releaseKeys.lists() }),
  });
};

export const useRevertir = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ambito,
      pin,
    }: {
      id: string;
      ambito: ReleaseAmbito;
      pin: string;
    }) =>
      api.post<{ ok: boolean }>(`/api/releases/${id}/rollback`, {
        ambito,
        pin,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: releaseKeys.all }),
  });
};

/**
 * Solo consulta MIENTRAS hay una reversion en curso.
 *
 * En reposo no hace ni una peticion: el presupuesto de esta pantalla es 0
 * peticiones repetidas estando quieta.
 */
export const useEstadoRollback = (activo: boolean) =>
  useQuery({
    queryKey: releaseKeys.estado(),
    queryFn: () => api.get<EstadoRollback>('/api/releases/rollback/estado'),
    enabled: activo,
    refetchInterval: activo ? 2000 : false,
  });
