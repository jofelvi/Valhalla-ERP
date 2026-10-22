const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface PagoDeclarado {
  id: string;
  method: string;
  amount: number;
  transactionId?: string | null;
  /** Foto del comprobante que subió el mesonero. */
  proofImageUrl?: string | null;
  createdAt?: string;
  userId?: string | null;
}

export interface OrdenSinCubrir {
  id: string;
  orderNumber?: string;
  createdAt?: string;
  tableName?: string;
  sector?: string;
  waiterName: string;
  customerName?: string;
  /** Consumo + propina: lo que había que cobrar. */
  debido: number;
  /** Suma de los pagos registrados. */
  declarado: number;
  faltante: number;
  items: Array<{ nombre: string; cantidad: number; total: number }>;
  pagos: PagoDeclarado[];
}

export interface ResumenCobrosIncompletos {
  desde: string;
  hasta: string;
  totalFaltante: number;
  ordenes: number;
  sinNingunPago: number;
  porMesonero: Array<{ waiterName: string; ordenes: number; faltante: number }>;
  detalle: OrdenSinCubrir[];
}

/**
 * Órdenes cerradas como pagadas cuyos pagos no cubren la cuenta.
 *
 * El filtrado real vive en el servidor: acá no se recalcula nada, para que la
 * pantalla y el endpoint nunca den números distintos.
 */
export async function fetchCobrosIncompletos(
  desde: string,
  hasta: string,
  token?: string,
): Promise<ResumenCobrosIncompletos> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${API_BASE_URL}/api/analytics/cobros-incompletos?from=${encodeURIComponent(desde)}&to=${encodeURIComponent(hasta)}`;
  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(
      res.status === 403
        ? 'Necesitas permisos de gerencia para ver esta pantalla'
        : 'No se pudieron cargar los cobros incompletos',
    );
  }
  return (await res.json()) as ResumenCobrosIncompletos;
}
