// Servicio especifico de cocina/barra. Wraps los endpoints de Fase 2:
//   - PATCH /api/orders/:id/items/:itemId/deliver
//   - PATCH /api/orders/:id/deliver-station/:station
//
// Las pantallas Kitchen/Bar reusan el patron de subscribeOrdersFiltered del
// orderService para tener actualizaciones en tiempo real via WebSocket.
import { api } from './api/apiClient';
import { Order, OrderItem } from '../types/models';

export type Station = 'KITCHEN' | 'BAR' | 'PIZZA';

// Evento ITEM_DELIVERED del backend (colección orderItemEvents)
export interface DeliveredEventRow {
  productId: string;
  productName?: string;
  qty: number;
  station?: string | null;
  occurredAt: string;
}

// Fila del histórico de despachos de la estación (con "a quién").
export interface StationDispatchRow {
  occurredAt: string;
  productName: string;
  qty: number;
  station: string;
  actorName: string;
  orderId: string;
  orderNumber: string;
  waiterName?: string | null;
  tableName?: string | null;
}

// Insumo disponible en el almacén de la estación.
export interface StationInsumoRow {
  productId: string;
  productName: string;
  qty: number;
  unit: string;
}

// Item enriquecido con su orden (para que la pantalla pueda agrupar/ordenar
// por orden o mostrar mesa, mesonero, etc.)
export interface PendingStationItem {
  // Order
  orderId: string;
  orderNumber?: string;
  tableName?: string;
  sector?: string;
  waiterName?: string;
  customerAlias?: string;
  orderCreatedAt: Date | null;

  // Item
  itemId: string;
  productId: string;
  productName: string;
  quantity: number;
  deliveredQty: number;
  pendingQty: number; // quantity - deliveredQty
  notes?: string;
  station: Station;
  // Cuanto tiempo lleva pendiente (en minutos, calculado al renderizar)
  addedAt?: Date;
  // Pack products (tobos, cajas): unidades totales del pack.
  // Si > 0 la UI muestra el control de rondas en lugar del control individual.
  presentationQty?: number;
}

// Construye la lista de items pendientes filtrados por estacion. Ignora
// items cancelados, ya entregados completamente, o de otra estacion.
export function flattenPendingItems(
  orders: Order[],
  station: Station,
): PendingStationItem[] {
  const out: PendingStationItem[] = [];
  for (const order of orders) {
    if (!order.items) continue;
    for (const item of order.items as Array<
      OrderItem & {
        _id?: string;
        cancelledAt?: Date | string | null;
        addedAt?: Date | string;
      }
    >) {
      if (item.cancelledAt) continue;
      const itemStation = String(item.station ?? '').toUpperCase();
      if (itemStation !== station) continue;
      const qty = Number(item.quantity ?? 0);
      const delivered = Number(item.deliveredQty ?? 0);
      if (delivered >= qty) continue;
      const itemId = String(item._id ?? '');
      if (!itemId) continue;

      out.push({
        orderId: order.id,
        orderNumber: order.orderNumber ?? undefined,
        tableName: order.tableName ?? undefined,
        sector: order.sector ?? undefined,
        waiterName: (order as unknown as { waiterName?: string }).waiterName,
        customerAlias: order.customerAlias ?? undefined,
        orderCreatedAt: order.createdAt,
        itemId,
        productId: item.productId,
        productName: (
          item.productName ??
          (item as unknown as { name?: string }).name ??
          'Producto'
        ).toString(),
        quantity: qty,
        deliveredQty: delivered,
        pendingQty: qty - delivered,
        notes: item.notes ?? undefined,
        station,
        addedAt: item.addedAt
          ? new Date(item.addedAt as unknown as string)
          : (order.createdAt ?? undefined),
        presentationQty: (item as OrderItem & { presentationQty?: number })
          .presentationQty,
      });
    }
  }
  // Ordenar por antiguedad (los mas viejos primero — prioridad de cocina)
  out.sort((a, b) => {
    const ta = (a.addedAt ?? a.orderCreatedAt)?.getTime?.() ?? 0;
    const tb = (b.addedAt ?? b.orderCreatedAt)?.getTime?.() ?? 0;
    return ta - tb;
  });
  return out;
}

export const kitchenOrderService = {
  // Marca delta unidades como entregadas. delta default 1.
  async deliverItem(orderId: string, itemId: string, delta = 1): Promise<void> {
    await api.patch(`/api/orders/${orderId}/items/${itemId}/deliver`, {
      delta,
    });
  },

  // Marca todas las unidades pendientes de un item como entregadas
  // (deliveredQty pasa a quantity). Util para "este item se entrego completo".
  async deliverItemAll(
    orderId: string,
    itemId: string,
    pendingQty: number,
  ): Promise<void> {
    if (pendingQty <= 0) return;
    await api.patch(`/api/orders/${orderId}/items/${itemId}/deliver`, {
      delta: pendingQty,
    });
  },

  // Bulk: marca como entregadas todas las unidades pendientes de la estacion
  // en esta orden. Para el boton "Listo todo de cocina" / "Listo todo de barra".
  async deliverStation(orderId: string, station: Station): Promise<void> {
    await api.patch(`/api/orders/${orderId}/deliver-station/${station}`, {});
  },

  // Entregas del actor en la jornada actual (6am a 6am — la madrugada cuenta
  // para el dia anterior). Alimenta el "Mi resumen de hoy" de barra/cocina.
  async getMyDeliveriesToday(actorId: string): Promise<DeliveredEventRow[]> {
    const now = new Date();
    const start = new Date(now);
    start.setHours(6, 0, 0, 0);
    if (now.getHours() < 6) start.setDate(start.getDate() - 1);
    return api.get<DeliveredEventRow[]>('/api/orders/item-events/deliveries', {
      actorId,
      from: start.toISOString(),
      to: now.toISOString(),
    });
  },

  // Histórico de despachos de TODA la estación en la jornada (6am-6am), con
  // el mesonero/mesa de cada orden y quién lo despachó.
  async getStationDispatchesToday(
    station: Station,
  ): Promise<StationDispatchRow[]> {
    const now = new Date();
    const start = new Date(now);
    start.setHours(6, 0, 0, 0);
    if (now.getHours() < 6) start.setDate(start.getDate() - 1);
    return api.get<StationDispatchRow[]>('/api/orders/item-events/by-station', {
      station,
      from: start.toISOString(),
      to: now.toISOString(),
    });
  },

  // Insumos disponibles en el almacén de la estación (barra/cocina/pizza).
  async getAvailableInsumos(station: Station): Promise<StationInsumoRow[]> {
    return api.get<StationInsumoRow[]>('/api/inventory/available', { station });
  },

  // La estación solicita al admin reposición de insumos desde el depósito.
  /**
   * Crea la solicitud de reposicion y devuelve su id, que es lo que permite
   * que un jefe la autorice en el acto con su PIN sin abrir su propia app.
   */
  async requestInsumos(
    station: Station,
    items: {
      productId: string;
      productName: string;
      qty: number;
      unit: string;
    }[],
    note?: string,
  ): Promise<{ id: string }> {
    const creada = await api.post<{ _id?: string; id?: string }>(
      '/api/insumo-requests',
      { station, items, note },
    );
    return { id: String(creada?.id ?? creada?._id ?? '') };
  },

  // Helper para mostrar minutos pendientes en la UI
  minutesSince(date: Date | undefined): number {
    if (!date) return 0;
    const t = date.getTime?.();
    if (!t) return 0;
    return Math.max(0, Math.floor((Date.now() - t) / 60000));
  },
};
