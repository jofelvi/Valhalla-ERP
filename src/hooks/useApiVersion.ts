import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import type { AppVersionInfo } from '@/shared/utils/appVersion';

/** UNA sola familia de keys para este recurso. */
export const versionKeys = {
  all: ['version'] as const,
  api: () => [...versionKeys.all, 'api'] as const,
};

/**
 * Version del API NestJS que esta respondiendo.
 *
 * El dato no cambia mientras el proceso viva, asi que no se revalida nunca:
 * el presupuesto de red en reposo de estas pantallas es 0 peticiones repetidas.
 * Para ver un deploy nuevo basta recargar.
 */
export const useApiVersion = () =>
  useQuery({
    queryKey: versionKeys.api(),
    queryFn: () => api.get<AppVersionInfo>('/api/version'),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
