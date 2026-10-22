'use client';
export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { usePOSData } from '@/hooks/useOrders';
import { Card } from '@/components/shared/card/card';
import Loader from '@/components/shared/Loader/Loader';
import { TableStatusEnum } from '@/shared';
import { Coffee, Users, Utensils, ChefHat, UserCheck } from 'lucide-react';
import { Order } from '@/modelTypes/order';
import { Table } from '@/modelTypes/table';
import { PRIVATE_ROUTES } from '@/shared';
import { Panel } from '@/components/shared/panel/Panel';

interface TableWithOrder extends Table {
  currentOrder?: Order | null;
}

// usePOSData() devuelve `unknown` (endpoint /api/orders/pos-data compartido
// por varias pantallas); se tipa en el punto de consumo, sin tocar el hook.
interface POSDataResponse {
  tables?: TableWithOrder[];
}

const getTableIcon = (capacity: number) => {
  if (capacity <= 2) return Users;
  if (capacity <= 4) return Coffee;
  if (capacity <= 6) return Utensils;
  return ChefHat;
};

export default function WaiterTablesPage() {
  const router = useRouter();
  const { data: posData, isLoading } = usePOSData();

  const tables: TableWithOrder[] =
    (posData as POSDataResponse | undefined)?.tables || [];

  const getTableStatus = (table: TableWithOrder): 'free' | 'occupied' => {
    if (table.currentOrder) return 'occupied';
    if (table.status === TableStatusEnum.OCCUPIED) return 'occupied';
    if (!table.isAvailable) return 'occupied';
    if (table.orderId) return 'occupied';
    return 'free';
  };

  const handleTableClick = (table: TableWithOrder) => {
    if (table.currentOrder) {
      router.push(
        `${PRIVATE_ROUTES.POS_ORDER}?tableId=${table.id}&orderId=${table.currentOrder.id}`,
      );
    } else {
      router.push(`${PRIVATE_ROUTES.POS_ORDER}?tableId=${table.id}`);
    }
  };

  if (isLoading) {
    return (
      <Loader fullScreen text="Cargando mesas..." size="lg" color="primary" />
    );
  }

  const freeCount = tables.filter((t) => getTableStatus(t) === 'free').length;

  return (
    <div className="p-3">
      <Panel className="p-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand/20 rounded-xl flex items-center justify-center">
            <Utensils className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h1 className="text-base font-bold text-content">Mesas</h1>
            <p className="text-xs text-dim">
              {tables.length} totales · {freeCount} disponibles
            </p>
          </div>
        </div>
      </Panel>

      {tables.length === 0 ? (
        <p className="text-sm text-dim text-center py-6">
          No hay mesas configuradas
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {tables.map((table) => {
            const TableIcon = getTableIcon(table.capacity);
            const occupied = getTableStatus(table) === 'occupied';
            const order = table.currentOrder;
            return (
              <Card
                key={table.id}
                onClick={() => handleTableClick(table)}
                className={`cursor-pointer transition-all overflow-hidden border-2 ${
                  occupied
                    ? 'bg-surface border-danger/30 hover:border-danger/60'
                    : 'bg-surface border-brand/20 hover:border-brand/50'
                }`}
              >
                <div
                  className={`px-3 py-2.5 ${
                    occupied
                      ? 'bg-gradient-to-r from-danger/10 to-transparent'
                      : 'bg-gradient-to-r from-brand/5 to-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        occupied
                          ? 'bg-gradient-to-br from-danger to-danger'
                          : 'bg-gradient-to-br from-brand to-brand-light'
                      }`}
                    >
                      <TableIcon className="w-4 h-4 text-on-brand" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-content leading-tight">
                        Mesa {table.number}
                      </h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Users className="w-2.5 h-2.5 text-dim" />
                        <span className="text-[10px] text-dim">
                          Cap. {table.capacity}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-3 py-2">
                  {!occupied ? (
                    <div className="flex items-center justify-center py-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand/10 text-brand rounded-full text-[10px] font-semibold">
                        <span className="w-1 h-1 bg-brand rounded-full animate-pulse"></span>
                        Disponible
                      </span>
                    </div>
                  ) : order ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-content">
                          ${order.total.toFixed(2)}
                        </span>
                        <span className="text-[9px] text-dim">
                          {order.items?.reduce(
                            (s, i) => s + (i.quantity || 0),
                            0,
                          ) ?? 0}{' '}
                          items
                        </span>
                      </div>
                      {order.waiterName && (
                        <div className="flex items-center gap-1 text-[10px] text-brand">
                          <UserCheck className="w-2.5 h-2.5" />
                          <span className="truncate font-semibold">
                            {order.waiterName}
                          </span>
                        </div>
                      )}
                      {order.customerAlias && (
                        <div className="text-[10px] text-dim truncate">
                          {order.customerAlias}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-dim text-center py-1">
                      Ocupada
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
