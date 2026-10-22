import { api } from './api/apiClient';
import { on as onSocket } from './api/socketClient';
import { toSafeDate } from './dateUtils';
import { Table, TableStatusEnum } from '../types';

type Unsubscribe = () => void;

interface RawTable {
  id?: string;
  _id?: string;
  name: string;
  capacity: number;
  status: TableStatusEnum;
  isAvailable?: boolean;
  orderId?: string | null;
  claimedBy?: string | null;
  claimedByName?: string | null;
  claimedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const normalize = (raw: RawTable): Table => ({
  id: String(raw.id ?? raw._id ?? ''),
  name: raw.name,
  capacity: raw.capacity,
  status: raw.status,
  orderId: raw.orderId ?? null,
  claimedBy: raw.claimedBy ?? null,
  claimedByName: raw.claimedByName ?? null,
  claimedAt: toSafeDate(raw.claimedAt),
  createdAt: toSafeDate(raw.createdAt),
  updatedAt: toSafeDate(raw.updatedAt),
});

const extractTableNumber = (name: string): number => {
  const match = name.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : Infinity;
};

const sortTablesNaturally = (tables: Table[]): Table[] =>
  tables
    .slice()
    .sort((a, b) => extractTableNumber(a.name) - extractTableNumber(b.name));

export const tableService = {
  async getAllTables(): Promise<Table[]> {
    const list = await api.get<RawTable[]>('/api/tables');
    return sortTablesNaturally(list.map(normalize));
  },

  /**
   * Suscripcion a cambios de mesas.
   * Hace fetch inicial y luego escucha eventos `table:updated` por WebSocket.
   * El callback recibe siempre el array completo ordenado.
   */
  subscribeToTables(callback: (tables: Table[]) => void): Unsubscribe {
    let cache: Table[] = [];
    let cancelled = false;
    let unsubscribe: Unsubscribe | null = null;

    const emit = () => {
      if (!cancelled) callback(sortTablesNaturally(cache));
    };

    void (async () => {
      // snapshot inicial
      try {
        cache = (await api.get<RawTable[]>('/api/tables')).map(normalize);
        emit();
      } catch (err) {
        console.error('subscribeToTables initial fetch error:', err);
      }

      if (cancelled) return;

      // escuchar updates en tiempo real
      try {
        unsubscribe = await onSocket<RawTable>('table:updated', (raw) => {
          const updated = normalize(raw);
          const idx = cache.findIndex((t) => t.id === updated.id);
          if (idx >= 0) cache[idx] = updated;
          else cache.push(updated);
          emit();
        });
      } catch (err) {
        console.error('subscribeToTables socket error:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  },

  async updateTableStatus(
    tableId: string,
    status: TableStatusEnum,
    orderId?: string | null,
  ): Promise<void> {
    await api.patch(`/api/tables/${tableId}/status`, {
      status,
      orderId: orderId ?? null,
      isAvailable: status === TableStatusEnum.ISAVAILABLE,
    });
  },

  /**
   * Reserva una mesa para un mesonero antes de crear la orden. Marca
   * status=OCCUPIED + claimedBy. El backend libera automaticamente si no
   * se envia heartbeat ni se crea orden en 5 minutos.
   */
  async claimTable(
    tableId: string,
    waiterId: string,
    waiterName?: string,
  ): Promise<Table> {
    const raw = await api.post<RawTable>(`/api/tables/${tableId}/claim`, {
      waiterId,
      waiterName,
    });
    return normalize(raw);
  },

  /**
   * Libera una reserva sin orden. Idempotente: si la mesa ya no es suya
   * o ya tiene orden, no hace nada.
   */
  async releaseTable(tableId: string, waiterId: string): Promise<void> {
    try {
      await api.post(`/api/tables/${tableId}/release`, { waiterId });
    } catch (err) {
      console.warn('[tableService] releaseTable error (ignorado):', err);
    }
  },

  /**
   * Renueva el timestamp de la reserva mientras el mesonero arma el pedido.
   * Seguro de llamar periodicamente.
   */
  async heartbeatTable(tableId: string, waiterId: string): Promise<void> {
    try {
      await api.post(`/api/tables/${tableId}/heartbeat`, { waiterId });
    } catch (err) {
      console.warn('[tableService] heartbeatTable error (ignorado):', err);
    }
  },
};
