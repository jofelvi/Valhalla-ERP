import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { AccountReceivable } from '@odin6/types';

export const arKeys = {
  all: ['accountsReceivable'] as const,
  lists: () => [...arKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...arKeys.lists(), filters] as const,
  details: () => [...arKeys.all, 'detail'] as const,
  detail: (id: string) => [...arKeys.details(), id] as const,
};

/** Los filtros viajan por querystring, asi que todo se serializa a texto. */
type ArFilters = Record<string, string | undefined>;

export function useAccountsReceivable(
  filters?: ArFilters,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: arKeys.list(filters),
    queryFn: () =>
      api.get<AccountReceivable[]>('/api/accounts-receivable', filters),
    enabled: options?.enabled,
  });
}

/** Totales de un grupo de cuentas. `pendiente` = facturado − pagado. */
export interface TotalesDeBloque {
  cuentas: number;
  facturado: number;
  pagado: number;
  pendiente: number;
}

export interface ResumenCartera {
  cartera: TotalesDeBloque;
  porEstado: (TotalesDeBloque & { estado: string })[];
  apartado: {
    anuladas: TotalesDeBloque;
    unificadas: TotalesDeBloque;
    socios: TotalesDeBloque & { motivo: string };
  };
}

/**
 * Totales de la cartera, calculados en la base con el MISMO criterio con el
 * que se arma la lista.
 *
 * Antes se sumaban en el navegador sobre las cuentas descargadas, y el
 * criterio no coincidia: apartaban las unificadas pero no las anuladas. La
 * tarjeta "Pendiente" decia $9.770,55 cuando lo real eran $8.392,82.
 */
export function useResumenCartera(filters?: ArFilters) {
  return useQuery({
    queryKey: [...arKeys.all, 'resumen', filters] as const,
    queryFn: () =>
      api.get<ResumenCartera>('/api/accounts-receivable/resumen', filters),
    // La cartera no cambia entre pestañazos: vale un minuto de frescura.
    staleTime: 60_000,
  });
}

/**
 * Cuentas por cobrar de VARIOS clientes en una sola peticion.
 *
 * Sustituye al hook por cliente suelto, que la nomina llamaba una vez por
 * fila: nueve peticiones medidas el 08/09/2026 al abrir /private/payroll.
 * Todas las filas piden la MISMA lista, asi que comparten clave y React Query
 * las funde en una sola llamada.
 *
 * La clave cuelga de `list()` a proposito: asi la invalidan las mutaciones de
 * cuentas por cobrar. La version anterior colgaba de una clave propia y NO se
 * refrescaba al cobrar.
 */
export function useAccountsReceivableByCustomers(
  customerIds: readonly string[],
) {
  const ids = [...new Set(customerIds.filter(Boolean))].sort().join(',');
  return useQuery({
    queryKey: arKeys.list({ customerIds: ids }),
    queryFn: () =>
      api.get<AccountReceivable[]>('/api/accounts-receivable', {
        customerIds: ids,
      }),
    enabled: ids.length > 0,
  });
}

export function useAccountsReceivableRecord(id: string) {
  return useQuery({
    queryKey: arKeys.detail(id),
    queryFn: () => api.get<AccountReceivable>(`/api/accounts-receivable/${id}`),
    enabled: !!id,
  });
}

export function useGetPublicAccountsReceivable(id: string) {
  return useQuery({
    queryKey: ['publicAR', id],
    queryFn: () =>
      api.get<AccountReceivable>(`/api/public/accounts-receivable/${id}`),
    enabled: !!id,
  });
}

export function useCreateAccountsReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AccountReceivable>) =>
      api.post<AccountReceivable>('/api/accounts-receivable', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: arKeys.lists() });
    },
  });
}

export function useUpdateAccountsReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<AccountReceivable>;
    }) => api.patch<AccountReceivable>(`/api/accounts-receivable/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: arKeys.lists() });
      qc.invalidateQueries({ queryKey: arKeys.detail(id) });
    },
  });
}

export function useMergeAccounts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountIds: string[]) =>
      api.post('/api/accounts-receivable/merge', { accountIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: arKeys.lists() });
    },
  });
}

export function useUnmergeAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      api.post('/api/accounts-receivable/unmerge', { accountId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: arKeys.lists() });
    },
  });
}

export function useDeleteAccountsReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/accounts-receivable/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: arKeys.lists() });
    },
  });
}
