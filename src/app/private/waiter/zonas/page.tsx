'use client';
export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePOSData } from '@/hooks/useOrders';
import { useUserStore } from '@/shared/store/useUserStore';
import { Card } from '@/components/shared/card/card';
import Loader from '@/components/shared/Loader/Loader';
import { PRIVATE_ROUTES, ZONAS_VISIBLES, ZoneSectorEnum } from '@/shared';
import {
  MapPin,
  Plus,
  ChevronDown,
  ChevronUp,
  Clock,
  Users,
  Hash,
} from 'lucide-react';
import { formatSmartTime } from '@/shared/utils/dateHelpers';
import { Order } from '@/modelTypes/order';
import { Panel } from '@/components/shared/panel/Panel';

// usePOSData() devuelve `unknown` (endpoint /api/orders/pos-data compartido
// por varias pantallas); se tipa en el punto de consumo, sin tocar el hook.
interface POSDataResponse {
  zoneOrders?: Order[];
}

const SECTOR_LABELS: Record<string, string> = {
  [ZoneSectorEnum.EVENTO]: 'Evento',
  [ZoneSectorEnum.PISCINA]: 'Piscina',
  [ZoneSectorEnum.TENIS]: 'Tenis',
  [ZoneSectorEnum.FUTBOL]: 'Futbol',
  [ZoneSectorEnum.BEISBOL]: 'Beisbol',
  [ZoneSectorEnum.SALON_PRINCIPAL]: 'Salon Principal',
  [ZoneSectorEnum.CANCHAS]: 'Canchas',
};

const SECTOR_ICONS: Record<string, string> = {
  [ZoneSectorEnum.EVENTO]: '🎉',
  [ZoneSectorEnum.PISCINA]: '🏊',
  [ZoneSectorEnum.TENIS]: '🎾',
  [ZoneSectorEnum.FUTBOL]: '⚽',
  [ZoneSectorEnum.BEISBOL]: '⚾',
  [ZoneSectorEnum.SALON_PRINCIPAL]: '🏛️',
  [ZoneSectorEnum.CANCHAS]: '🏟️',
};

export default function WaiterZonesPage() {
  const router = useRouter();
  const { data: posData, isLoading } = usePOSData();
  const user = useUserStore((s) => s.user);
  const userId = user?.id;

  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(Object.values(ZoneSectorEnum)),
  );
  const [showNewOrderMenu, setShowNewOrderMenu] = useState(false);

  const myZoneOrders = useMemo(() => {
    const all = (posData as POSDataResponse | undefined)?.zoneOrders || [];
    if (!userId) return [];
    return all.filter((o) => (o.waiterId || o.userId) === userId);
  }, [posData, userId]);

  const ordersBySector = useMemo(() => {
    const grouped: Record<string, Order[]> = {};
    for (const order of myZoneOrders) {
      const sector = order.sector || 'sin_sector';
      if (!grouped[sector]) grouped[sector] = [];
      grouped[sector].push(order);
    }
    return grouped;
  }, [myZoneOrders]);

  // Las zonas visibles, más cualquier zona oculta que todavía tenga pedidos (no se pierden de vista).
  const allSectors = Array.from(
    new Set<string>([...ZONAS_VISIBLES, ...Object.keys(ordersBySector)]),
  );

  const toggleSector = (sector: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  };

  const handleNewZoneOrder = (sector: string) => {
    const params = new URLSearchParams({ sector });
    if (userId) params.set('waiterId', userId);
    router.push(`${PRIVATE_ROUTES.POS_ORDER}?${params.toString()}`);
    setShowNewOrderMenu(false);
  };

  const handleOrderClick = (order: Order) => {
    const params = new URLSearchParams({ orderId: order.id });
    if (order.sector) params.set('sector', order.sector);
    if (order.waiterId) params.set('waiterId', order.waiterId);
    router.push(`${PRIVATE_ROUTES.POS_ORDER}?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <Loader fullScreen text="Cargando zonas..." size="lg" color="primary" />
    );
  }

  const total = myZoneOrders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="p-3">
      <Panel className="p-3 mb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-brand/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <MapPin className="h-5 w-5 text-brand" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-content">Mis Zonas</h1>
              <p className="text-xs text-dim">
                {myZoneOrders.length} ordenes · ${total.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNewOrderMenu(!showNewOrderMenu)}
              className="px-3 py-1.5 bg-brand text-on-brand rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva
            </button>
            {showNewOrderMenu && (
              <div className="absolute right-0 top-full mt-1 bg-surface rounded-lg shadow-xl border border-line p-2 min-w-[180px] z-30">
                {allSectors.map((sector) => (
                  <button
                    key={sector}
                    type="button"
                    onClick={() => handleNewZoneOrder(sector)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-elevated rounded flex items-center gap-2 text-content"
                  >
                    <span>{SECTOR_ICONS[sector] || '📍'}</span>
                    <span>{SECTOR_LABELS[sector] || sector}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>

      {myZoneOrders.length === 0 ? (
        <p className="text-sm text-dim text-center py-8">
          No tienes ordenes de zona activas. Crea una con &quot;Nueva&quot;.
        </p>
      ) : (
        <div className="space-y-2.5">
          {allSectors
            .filter((sector) => (ordersBySector[sector] || []).length > 0)
            .map((sector) => {
              const orders = ordersBySector[sector] || [];
              const isOpen = expanded.has(sector);
              const sectorTotal = orders.reduce((s, o) => s + o.total, 0);

              return (
                <Card
                  key={sector}
                  className="bg-surface/90 border border-line/50 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleSector(sector)}
                    className="w-full p-3 flex items-center justify-between hover:bg-elevated/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {SECTOR_ICONS[sector] || '📍'}
                      </span>
                      <div className="text-left">
                        <h3 className="text-sm font-bold text-content">
                          {SECTOR_LABELS[sector] || sector}
                        </h3>
                        <p className="text-xs text-dim">
                          {orders.length}{' '}
                          {orders.length === 1 ? 'orden' : 'ordenes'} · $
                          {sectorTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-dim" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-dim" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="border-t border-line p-2 space-y-2">
                      {orders.map((order) => (
                        <Card
                          key={order.id}
                          onClick={() => handleOrderClick(order)}
                          className="cursor-pointer bg-gradient-to-br from-brand/5 to-elevated border border-brand/20 hover:border-brand/40 transition-all"
                        >
                          <div className="p-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-mono text-dim">
                                #{order.id.slice(-6).toUpperCase()}
                              </span>
                              <span className="text-sm font-bold text-brand">
                                ${order.total.toFixed(2)}
                              </span>
                            </div>

                            {order.customerAlias && (
                              <div className="flex items-center gap-1 text-xs text-content">
                                <Users className="w-3 h-3" />
                                <span className="truncate font-medium">
                                  {order.customerAlias}
                                </span>
                              </div>
                            )}

                            {order.associateNumber && (
                              <div className="flex items-center gap-1 text-[11px] text-dim">
                                <Hash className="w-2.5 h-2.5" />
                                <span>Socio {order.associateNumber}</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-1 text-[10px] text-dim">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatSmartTime(order.createdAt)}</span>
                              </div>
                              <span>{order.items.length} items</span>
                            </div>

                            {order.paymentRejected && (
                              <div className="mt-1.5 px-2 py-1 bg-danger/10 border border-danger/20 rounded">
                                <p className="text-[10px] font-bold text-danger">
                                  🚫 Pago rechazado
                                </p>
                                {order.paymentRejectionReason && (
                                  <p className="text-[9px] text-danger">
                                    {order.paymentRejectionReason}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}
