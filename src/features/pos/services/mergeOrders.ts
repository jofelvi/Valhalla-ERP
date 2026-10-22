const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Orden candidata a ser absorbida por otra. */
export interface OrdenFusionable {
  id: string;
  orderNumber?: string;
  tableName?: string;
  sector?: string;
  waiterName?: string;
  total: number;
  itemsCount: number;
}

interface OrdenApi {
  id?: string;
  _id?: string;
  orderNumber?: string;
  tableName?: string;
  tableId?: string | null;
  sector?: string;
  waiterName?: string;
  total?: number;
  paidAmount?: number;
  paymentStatus?: string;
  status?: string;
  isDeleted?: boolean;
  mergedIntoOrderId?: string;
  items?: unknown[];
}

/**
 * Una orden se puede absorber solo si no arrastra plata ni compromisos.
 *
 * Se filtra tambien en el cliente para no ofrecerle al cajero opciones que el
 * backend va a rechazar. El backend valida igual: esto es comodidad, no
 * control — un filtro de UI no protege nada.
 */
function esFusionable(o: OrdenApi, destinoId: string): boolean {
  const id = String(o.id ?? o._id ?? '');
  if (!id || id === destinoId) return false;
  if (o.isDeleted) return false;
  if (o.mergedIntoOrderId) return false;
  if (String(o.status ?? '').toUpperCase() === 'CANCELLED') return false;
  if ((o.paidAmount ?? 0) > 0) return false;
  return !['paid', 'partial', 'cancelled'].includes(
    String(o.paymentStatus ?? '').toLowerCase(),
  );
}

/** Órdenes abiertas que pueden fusionarse dentro de `destinoId`. */
export async function fetchOrdenesFusionables(
  destinoId: string,
  token?: string,
): Promise<OrdenFusionable[]> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/api/orders?active=true`, {
    headers,
  });
  if (!res.ok) {
    throw new Error('No se pudieron cargar las órdenes abiertas');
  }

  const data = (await res.json()) as OrdenApi[];
  return (Array.isArray(data) ? data : [])
    .filter((o) => esFusionable(o, destinoId))
    .map((o) => ({
      id: String(o.id ?? o._id),
      orderNumber: o.orderNumber,
      tableName: o.tableName ?? undefined,
      sector: o.sector ?? undefined,
      waiterName: o.waiterName ?? undefined,
      total: o.total ?? 0,
      itemsCount: Array.isArray(o.items) ? o.items.length : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Fusiona `sourceOrderId` dentro de `destinoId`.
 *
 * El PIN lo valida el servidor: mandarlo desde acá no autoriza nada por sí
 * solo, y un cliente viejo no puede saltarse la validación.
 */
export async function fusionarOrden(
  destinoId: string,
  sourceOrderId: string,
  pin: string,
  token?: string,
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/api/orders/${destinoId}/merge`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sourceOrderId, pin }),
  });

  if (!res.ok) {
    let mensaje = 'No se pudo fusionar la orden';
    try {
      const err = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(err.message)) mensaje = err.message.join(' · ');
      else if (err.message) mensaje = err.message;
    } catch {
      // Respuesta sin cuerpo JSON: queda el mensaje genérico.
    }
    throw new Error(mensaje);
  }
}
