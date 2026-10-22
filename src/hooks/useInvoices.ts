import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { Invoice } from '@odin6/types';

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters?: FiltrosDeFacturas) =>
    [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
  byNumber: (number: string) => [...invoiceKeys.all, 'number', number] as const,
  byOrder: (orderId: string) => [...invoiceKeys.all, 'order', orderId] as const,
};

/**
 * Filtros que `GET /api/invoices` entiende de verdad.
 *
 * Antes era `Record<string, unknown>` casteado a `Record<string,string>`: se
 * podia mandar cualquier cosa y el servidor la ignoraba en silencio. Asi vivio
 * `useInvoiceByOrder` mandando `orderId` a un endpoint que no lo leia.
 *
 * `limit` tiene tope duro de 2.000 en el servidor y 500 por defecto. Una
 * pantalla que necesite mas tiene que pedirlo, no darlo por hecho.
 */
export interface FiltrosDeFacturas {
  orderId?: string;
  customerId?: string;
  from?: string;
  to?: string;
  limit?: string;
  page?: string;
  /**
   * `'lista'` recorta a los campos de la tabla. Deja fuera `items`, que es el
   * 56% del peso — y lo que el PDF necesita, así que solo lo pide quien pinta
   * una tabla. Cualquier otro valor se ignora y llega la factura completa.
   */
  vista?: 'lista';
}

function comoParametros(filtros?: FiltrosDeFacturas): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filtros ?? {}).filter(
      ([, v]) => v !== undefined && v !== '',
    ),
  ) as Record<string, string>;
}

export function useInvoices(filters?: FiltrosDeFacturas) {
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: () => api.get<Invoice[]>('/api/invoices', comoParametros(filters)),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => api.get<Invoice>(`/api/invoices/${id}`),
    enabled: !!id,
  });
}

export function useInvoiceByNumber(number: string) {
  return useQuery({
    queryKey: invoiceKeys.byNumber(number),
    queryFn: () => api.get<Invoice>(`/api/public/orders/${number}`),
    enabled: !!number,
  });
}

/**
 * LA factura de una orden, o `null` si todavia no se emitio.
 *
 * El endpoint responde un ARREGLO —siempre lo hizo— y este hook lo tipaba como
 * `Invoice`. La pantalla de cobro ya llevaba un comentario reconociendo que el
 * tipo mentia y normalizaba a mano. Peor: el `orderId` que mandaba **no
 * existia como parametro en la API** hasta hoy, asi que recibia el historico
 * entero de facturacion y se quedaba con el primero, que no tenia por que ser
 * el de esta orden.
 *
 * Ahora el servidor filtra y el `select` devuelve una sola factura ya tipada.
 */
export function useInvoiceByOrder(orderId: string) {
  return useQuery({
    queryKey: invoiceKeys.byOrder(orderId),
    queryFn: () => api.get<Invoice[]>('/api/invoices', { orderId }),
    select: (facturas): Invoice | null => facturas[0] ?? null,
    enabled: !!orderId,
  });
}

/**
 * Trae LA factura completa, a demanda y cacheada.
 *
 * El listado pide `vista=lista`, que no trae `items` —el 56% del peso—. El
 * PDF si los necesita: sin ellos saldria con la tabla de lineas vacia y sin un
 * solo error. Asi que el PDF pide la factura entera cuando lo pulsan, y no
 * 2.000 veces por si acaso.
 */
export function useCargarFacturaCompleta() {
  const qc = useQueryClient();
  return (id: string) =>
    qc.fetchQuery({
      queryKey: invoiceKeys.detail(id),
      queryFn: () => api.get<Invoice>(`/api/invoices/${id}`),
    });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Invoice>) =>
      api.post<Invoice>('/api/invoices', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Invoice> }) =>
      api.patch<Invoice>(`/api/invoices/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: invoiceKeys.lists() });
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/invoices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}
