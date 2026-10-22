'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { tableKeys } from './useTables';
import { orderKeys } from './useOrders';
import { creditRequestsKeys } from './useCreditRequests';
import { isActivePosOrder } from './posOrderCache';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Singleton socket a nivel modulo: multiples componentes montados comparten
// una sola conexion /pos. Se cierra solo cuando no hay referencias vivas.
let sharedSocket: Socket | null = null;
let refCount = 0;

function getSocket(): Socket {
  if (sharedSocket && !sharedSocket.connected && sharedSocket.disconnected) {
    try {
      sharedSocket.removeAllListeners();
    } catch {
      // noop
    }
    sharedSocket = null;
  }
  if (!sharedSocket) {
    sharedSocket = io(`${API_URL}/pos`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return sharedSocket;
}

type OrderPayload = {
  id?: string;
  _id?: string;
  tableId?: string | null;
  status?: string;
  [k: string]: unknown;
};
type TablePayload = {
  id?: string;
  _id?: string;
  [k: string]: unknown;
};

// Throttle por entidad: cada id se aplica a cache a lo mas una vez por ventana.
const MIN_APPLY_INTERVAL_MS = 120;
// Edad maxima de una entrada en el Map antes de limpiarla (evita memory leak
// en sesiones largas con cientos de ids distintos).
const ENTITY_MAX_AGE_MS = 5_000;
const MAX_EVENTS_PER_SEC = 60;

const getId = (o: { id?: string; _id?: string }) => o.id ?? o._id;

function upsertInArray<T extends { id?: string; _id?: string }>(
  arr: T[] | undefined,
  item: T,
): T[] {
  if (!Array.isArray(arr)) return [item];
  const id = getId(item);
  const idx = arr.findIndex((x) => getId(x) === id);
  if (idx < 0) return [item, ...arr];
  const next = arr.slice();
  next[idx] = { ...arr[idx], ...item };
  return next;
}

function removeFromArray<T extends { id?: string; _id?: string }>(
  arr: T[] | undefined,
  id: string,
): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((x) => getId(x) !== id);
}

/**
 * Escucha eventos realtime del backend (`/pos`) y actualiza la cache de
 * React Query en-sitio (setQueriesData granular, sin invalidar/refetch).
 */
export function useRealtimePos() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    refCount += 1;

    const lastApplyByEntity = new Map<string, number>();
    let eventCount = 0;
    let eventWindowStart = Date.now();

    const bumpWatchdog = () => {
      eventCount += 1;
      const now = Date.now();
      if (now - eventWindowStart >= 1000) {
        if (eventCount > MAX_EVENTS_PER_SEC) {
          // eslint-disable-next-line no-console
          console.warn(
            `[useRealtimePos] ${eventCount} eventos WS/s (umbral ${MAX_EVENTS_PER_SEC}). Posible loop.`,
          );
        }
        eventCount = 0;
        eventWindowStart = now;
      }
    };

    const shouldApply = (key: string): boolean => {
      const now = Date.now();
      const last = lastApplyByEntity.get(key) ?? 0;
      if (now - last < MIN_APPLY_INTERVAL_MS) return false;
      lastApplyByEntity.set(key, now);
      // Limpieza por EDAD cada vez: entries mas viejos que ENTITY_MAX_AGE_MS
      // se eliminan. Esto acota el tamaño del Map independientemente del
      // volumen de ids unicos vistos en la sesion.
      const cutoff = now - ENTITY_MAX_AGE_MS;
      for (const [k, t] of lastApplyByEntity) {
        if (t < cutoff) lastApplyByEntity.delete(k);
      }
      return true;
    };

    // --- Updaters granulares (sin invalidate/refetch) --------------------

    const upsertOrderInLists = (order: OrderPayload) => {
      // Todas las queries con prefix orderKeys.lists() (cualquier filter)
      qc.setQueriesData<OrderPayload[]>(
        { queryKey: orderKeys.lists() },
        (old) => upsertInArray(old, order),
      );
      // pos-data tiene shape { activeOrders, tables, users }
      qc.setQueryData<{ activeOrders?: OrderPayload[]; [k: string]: unknown }>(
        orderKeys.pos(),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            activeOrders: upsertInArray(old.activeOrders, order),
          };
        },
      );
    };

    const removeOrderFromLists = (id: string) => {
      qc.setQueriesData<OrderPayload[]>(
        { queryKey: orderKeys.lists() },
        (old) => removeFromArray(old, id),
      );
      qc.setQueryData<{ activeOrders?: OrderPayload[]; [k: string]: unknown }>(
        orderKeys.pos(),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            activeOrders: removeFromArray(old.activeOrders, id),
          };
        },
      );
    };

    const upsertTableInLists = (table: TablePayload) => {
      qc.setQueriesData<TablePayload[]>(
        { queryKey: tableKeys.lists() },
        (old) => upsertInArray(old, table),
      );
      qc.setQueryData<{ tables?: TablePayload[]; [k: string]: unknown }>(
        orderKeys.pos(),
        (old) => {
          if (!old) return old;
          return { ...old, tables: upsertInArray(old.tables, table) };
        },
      );
    };

    // --- Handlers --------------------------------------------------------

    // Aplica un evento order:created/updated a la cache del POS.
    // Si la orden dejo de estar activa (cancelada/pagada/credito/borrada) se
    // SACA de la cache en vez de hacer upsert; si no, una orden reseteada
    // (llega como CANCELLED+isDeleted) queda pegada como currentOrder de la
    // mesa y la bloquea en rojo (mesa zombie). La remocion NO pasa por el
    // throttle: es un evento raro y terminal que debe aplicarse siempre.
    const applyOrderEvent = (order: OrderPayload) => {
      bumpWatchdog();
      const id = getId(order);
      if (!id) return;

      // Pedir, aprobar, rechazar o anular un credito emite order:updated con
      // `creditRequest`: la lista de solicitudes se refresca al instante y el
      // sondeo queda solo de red de seguridad (ver useCreditRequests).
      if (order.creditRequest) {
        void qc.invalidateQueries({ queryKey: creditRequestsKeys.pending() });
      }

      if (!isActivePosOrder(order)) {
        qc.removeQueries({ queryKey: orderKeys.detail(id) });
        removeOrderFromLists(id);
        if (order.tableId) {
          qc.removeQueries({ queryKey: orderKeys.byTable(order.tableId) });
        }
        return;
      }

      if (!shouldApply(`order:${id}`)) return;
      qc.setQueryData(orderKeys.detail(id), order);
      upsertOrderInLists(order);
      if (order.tableId) {
        qc.setQueryData(orderKeys.byTable(order.tableId), order);
      }
    };

    const handleOrderCreated = applyOrderEvent;
    const handleOrderUpdated = applyOrderEvent;

    const handleOrderDeleted = (payload: { id: string }) => {
      bumpWatchdog();
      if (!payload?.id) return;
      qc.removeQueries({ queryKey: orderKeys.detail(payload.id) });
      removeOrderFromLists(payload.id);
    };

    const handleTableUpdated = (table: TablePayload) => {
      bumpWatchdog();
      const id = getId(table);
      if (!id) return;
      if (!shouldApply(`table:${id}`)) return;
      qc.setQueryData(tableKeys.detail(id), table);
      upsertTableInLists(table);
    };

    socket.on('table:updated', handleTableUpdated);
    socket.on('order:created', handleOrderCreated);
    socket.on('order:updated', handleOrderUpdated);
    socket.on('order:deleted', handleOrderDeleted);

    return () => {
      socket.off('table:updated', handleTableUpdated);
      socket.off('order:created', handleOrderCreated);
      socket.off('order:updated', handleOrderUpdated);
      socket.off('order:deleted', handleOrderDeleted);

      lastApplyByEntity.clear();

      refCount -= 1;
      if (refCount <= 0 && sharedSocket) {
        try {
          sharedSocket.removeAllListeners();
          sharedSocket.disconnect();
        } catch {
          // noop
        }
        sharedSocket = null;
        refCount = 0;
      }
    };
  }, [qc]);
}
