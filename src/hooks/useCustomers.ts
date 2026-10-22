import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { Customer } from '@odin6/types';

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filters?: FiltrosDeClientes) =>
    [...customerKeys.lists(), filters] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
  byMember: (action: string) =>
    [...customerKeys.all, 'member', action] as const,
  search: (q: string) => [...customerKeys.all, 'search', q] as const,
};

/** Opciones de carga. `enabled: false` deja la consulta dormida. */
interface OpcionesDeCarga {
  enabled?: boolean;
}

/**
 * Filtros que `GET /api/customers` entiende de verdad.
 *
 * Antes era `Record<string, unknown>` casteado a `Record<string,string>`: se
 * podia mandar cualquier cosa y el servidor la ignoraba en silencio.
 */
export interface FiltrosDeClientes {
  /**
   * `'lista'` recorta a lo que pintan los listados (nombre, telefono, correo,
   * cedula, accion, activo). Deja fuera fechas, credito, direccion y la
   * metadata muerta de Firebase. Cualquier otro valor trae la ficha completa.
   */
  vista?: 'lista';
  /** `'true'` deja fuera las fichas dadas de baja. */
  activos?: 'true';
  limit?: string;
  page?: string;
}

function comoParametros(filtros?: FiltrosDeClientes): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filtros ?? {}).filter(
      ([, v]) => v !== undefined && v !== '',
    ),
  ) as Record<string, string>;
}

/**
 * La lista de clientes.
 *
 * Son 2.955 registros y 1,16 MB **sin recortar**, asi que conviene no pedirla
 * hasta que haga falta de verdad: la pantalla de usuarios la traia siempre,
 * aunque el visitante solo fuera a mirar al personal, y el listado de personal
 * se quedaba esperando detras de ella.
 *
 * Quien solo pinte una tabla o alimente un selector deberia pasar
 * `{ vista: 'lista' }`: casi la mitad de ese megabyte son nombres de campo
 * repetidos 2.955 veces, asi que cada campo que se deja fuera se lleva su
 * valor Y su nombre.
 */
export function useCustomers(
  filters?: FiltrosDeClientes,
  opciones?: OpcionesDeCarga,
) {
  return useQuery({
    queryKey: customerKeys.list(filters),
    queryFn: () =>
      api.get<Customer[]>('/api/customers', comoParametros(filters)),
    enabled: opciones?.enabled ?? true,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => api.get<Customer>(`/api/customers/${id}`),
    enabled: !!id,
  });
}

export function useSearchCustomers(q: string) {
  return useQuery({
    queryKey: customerKeys.search(q),
    queryFn: () => api.get<Customer[]>('/api/customers/search', { q }),
    enabled: !!q && q.length > 2,
  });
}

interface MemberResponse {
  accion: string | number;
  cedula: string;
  nombre: string;
}

export function useCustomerByMember(action: string) {
  return useQuery({
    queryKey: customerKeys.byMember(action),
    queryFn: async (): Promise<Customer | null> => {
      const padded = String(action).padStart(5, '0');
      // 1. El socio ya puede existir como customer en Mongo (migrado). Si
      //    existe, usamos ese — tiene id real y todos los campos.
      try {
        const results = await api.get<Customer[]>('/api/customers/search', {
          q: padded,
        });
        const match = results.find(
          (c) => c.memberAction === padded || c.memberAction === action,
        );
        if (match) return match;
      } catch {
        // ignorar y caer al fallback
      }
      // 2. Fallback: lookup al endpoint /api/public/members (Mongo, col
      //    `members`). Devolvemos una shape compatible con Customer pero
      //    con id vacio — el llamador debe detectar esto y forzar al
      //    usuario a crear/seleccionar un customer real antes de crear
      //    account-receivable.
      try {
        const member = await api.get<MemberResponse>(
          `/api/public/members/${action}`,
        );
        if (!member?.nombre) return null;
        return {
          id: '',
          name: member.nombre,
          phone: '',
          memberAction: padded,
          identificationId: member.cedula || '',
          isActive: true,
        } as unknown as Customer;
      } catch {
        return null;
      }
    },
    enabled: !!action,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Customer>) =>
      api.post<Customer>('/api/customers', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Customer> }) =>
      api.patch<Customer>(`/api/customers/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: customerKeys.lists() });
      qc.invalidateQueries({ queryKey: customerKeys.detail(id) });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}
