import { api } from '@/services/api/apiClient';

/**
 * Ficha de estacion (el papel con el QR).
 *
 * POR QUE EXISTE ESTE ARCHIVO
 * Barra, cocina y pizza son estaciones de "control estricto": solo entregan
 * escaneando el QR de la ficha. La app movil ya la encolaba al crear el pedido,
 * pero el POS web NUNCA lo hizo — solo mandaba comanda/precuenta/recibo. Los
 * pedidos hechos desde el POS salian sin QR y esas estaciones no podian
 * despachar.
 *
 * El reparto por estacion lo hace el servidor: al recibir un job de tipo
 * 'ficha' valida el token, relee la ficha real (que si sabe la estacion de cada
 * item) y crea un trabajo por estacion, cada uno con su QR y solo sus
 * productos. Aqui basta con encolar una vez.
 */

interface FichaVariante {
  variantName: string;
  pendingQty: number;
}

interface FichaItem {
  productName: string;
  pendingQty: number;
  station: string;
  composition?: FichaVariante[];
}

interface FichaView {
  orderId: string;
  orderNumber: string;
  tableName?: string | null;
  sector?: string | null;
  waiterName?: string | null;
  fichaToken: string;
  items: FichaItem[];
}

/**
 * Encola la impresion de la ficha del pedido.
 *
 * Pensado para llamarse en fire-and-forget despues de mandar la comanda: si
 * falla, el pedido y la comanda no se ven afectados. Devuelve `true` si se
 * encolo algo.
 */
export async function enqueuePrintFicha(orderId: string): Promise<boolean> {
  if (!orderId) return false;

  const ficha = await api.get<FichaView>(`/api/orders/${orderId}/ficha`);

  // Sin items de estaciones controladas no hay nada que escanear.
  if (!ficha?.items?.length) return false;

  const ahora = new Date();
  const payload = {
    orderNumber: ficha.orderNumber,
    date: ahora.toLocaleDateString('es-VE'),
    time: ahora.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    table: ficha.tableName ?? ficha.sector ?? undefined,
    waiter: ficha.waiterName ?? undefined,
    qrData: ficha.fichaToken,
    // El servidor reemplaza estos items por los de cada estacion al partir el
    // trabajo. Se mandan igual para que la ficha siga saliendo completa si
    // alguna vez corre contra una API que no sepa partirla.
    items: ficha.items.map((it) => ({
      productName: it.productName,
      pendingQty: it.pendingQty,
      variants: (it.composition ?? []).map((v) => ({
        name: v.variantName,
        pendingQty: v.pendingQty,
      })),
    })),
    totalPending: ficha.items.reduce((suma, it) => suma + it.pendingQty, 0),
  };

  await api.post('/api/print-queue', { type: 'ficha', orderId, payload });
  return true;
}

/**
 * Igual que `enqueuePrintFicha` pero sin propagar errores: para llamarlo
 * despues de la comanda sin arriesgar el flujo del mesonero. Un fallo aqui
 * significa "no salio el QR", no "se perdio el pedido".
 */
export function enqueuePrintFichaSafe(orderId: string): void {
  void enqueuePrintFicha(orderId).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ficha] No se pudo encolar la ficha con QR:', msg);
  });
}
