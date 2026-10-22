import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';

/** Una linea de stock dentro del dia de almacen. */
export interface StockDeAlmacen {
  productId: string;
  cantidad: number;
}

/**
 * El dia de almacen tal como lo devuelve la API
 * (`almacen-diario.schema.ts`), no como se habia escrito aqui a mano.
 */
export interface AlmacenDiario {
  id: string;
  fecha: string;
  estado: 'abierto' | 'cerrado';
  horaApertura: string;
  horaCierre?: string;
  stockInicial: StockDeAlmacen[];
  stockActual: StockDeAlmacen[];
  movimientos: unknown[];
  ventasRef: { orderId: string; timestamp: string; total: number }[];
  resumen?: {
    totalProductosInicial: number;
    totalVentas: number;
    totalProductosFinal: number;
    montoTotalVentas: number;
    numeroOrdenes: number;
  };
  usuarioApertura?: string;
  usuarioCierre?: string;
}

export interface ProductoEnAlmacenGeneral {
  productId: string;
  stockDisponible: number;
  ubicacion?: string;
  fechaUltimaActualizacion?: string;
}

/**
 * `GET /api/almacen/general` devuelve UN documento con la lista dentro,
 * no un arreglo de lineas. Estaba declarado como arreglo y la pantalla
 * hacia `.map()` sobre el objeto: `almacenData.map is not a function`.
 */
export interface AlmacenGeneral {
  id: string;
  productos: ProductoEnAlmacenGeneral[];
}

export const almacenKeys = {
  all: ['almacen'] as const,
  diario: () => [...almacenKeys.all, 'diario'] as const,
  diarioActivo: () => [...almacenKeys.diario(), 'activo'] as const,
  general: () => [...almacenKeys.all, 'general'] as const,
};

export function useAlmacenDiarioActivo() {
  return useQuery({
    queryKey: almacenKeys.diarioActivo(),
    queryFn: () => api.get<AlmacenDiario>('/api/almacen/diario/activo'),
  });
}

export function useAlmacenGeneral() {
  return useQuery({
    queryKey: almacenKeys.general(),
    queryFn: () => api.get<AlmacenGeneral>('/api/almacen/general'),
  });
}

export function useAbrirDia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.post('/api/almacen/diario/abrir', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: almacenKeys.diario() });
    },
  });
}

export function useCerrarDia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.post('/api/almacen/diario/cerrar', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: almacenKeys.diario() });
    },
  });
}

export function useRegistrarMovimiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.post('/api/almacen/movimiento', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: almacenKeys.general() });
      qc.invalidateQueries({ queryKey: almacenKeys.diario() });
    },
  });
}

/**
 * Engancha una orden al dia de almacen abierto, si lo hay.
 *
 * Antes esto iba a Firestore (`almacen-diario`), donde los dos unicos
 * documentos llevan cerrados desde febrero: la llamada salia por el `return`
 * temprano y no hacia nada. La pantalla del almacen diario ya lee de la API,
 * asi que la escritura tenia que venir aqui tambien.
 *
 * Sigue siendo best-effort: si no hay dia abierto o falla, la venta no se
 * detiene por esto.
 */
export async function vincularOrdenAlDiaDeAlmacen(
  orderId: string,
): Promise<void> {
  const dia = await api
    .get<AlmacenDiario | null>('/api/almacen/diario/activo')
    .catch(() => null);
  if (!dia?.fecha) return;
  // El controlador es `diario/:fecha/vincular-orden` y hace `new Date(fecha)`:
  // mandarle el _id del documento daba Invalid Date y la orden no se vinculaba.
  const fecha = String(dia.fecha).slice(0, 10);
  await api.post(`/api/almacen/diario/${fecha}/vincular-orden`, { orderId });
}
