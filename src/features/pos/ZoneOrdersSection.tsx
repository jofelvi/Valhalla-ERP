'use client';

import { useState } from 'react';
import { Order } from '@/modelTypes/order';
import { User } from '@/modelTypes/user';
import { Card } from '@/components/shared/card/card';
import { Badge } from '@/components/shared/badge/badge';
import { Button } from '@/components/shared/button/Button';
import { formatSmartTime } from '@/shared/utils/dateHelpers';
import { PRIVATE_ROUTES, ZONAS_VISIBLES, ZoneSectorEnum } from '@/shared';
import { useRouter } from 'next/navigation';
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Plus,
  MapPin,
  UserCheck,
  Hash,
  Pencil,
  Users,
  Eraser,
} from 'lucide-react';

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

interface ZoneOrdersSectionProps {
  zoneOrders: Order[];
  waiters: User[];
  allUsers?: User[];
  getOrderStatusColor: (status: string) => string;
  getOrderStatusText: (status: string) => string;
  onTransferOrder?: (order: Order) => void;
  onEditAlias?: (order: Order) => void;
  onResetOrder?: (order: Order) => void;
}

export default function ZoneOrdersSection({
  zoneOrders,
  waiters,
  allUsers,
  getOrderStatusColor,
  getOrderStatusText,
  onTransferOrder,
  onEditAlias,
  onResetOrder,
}: ZoneOrdersSectionProps) {
  const router = useRouter();
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(
    new Set(Object.values(ZoneSectorEnum)),
  );
  const [selectedWaiterId, setSelectedWaiterId] = useState<string | null>(null);

  // Usar allUsers para resolver nombres (incluye cajeros y admins), fallback a waiters
  const userMap = new Map((allUsers ?? waiters).map((u) => [u.id, u]));
  const waiterMap = userMap;

  // Filtrar ordenes por mesonero seleccionado (fallback a userId si waiterId es null)
  const filteredZoneOrders = selectedWaiterId
    ? zoneOrders.filter((o) => (o.waiterId || o.userId) === selectedWaiterId)
    : zoneOrders;

  // Agrupar ordenes por sector
  const ordersBySector = filteredZoneOrders.reduce<Record<string, Order[]>>(
    (acc, order) => {
      const sector = order.sector || 'sin_sector';
      if (!acc[sector]) acc[sector] = [];
      acc[sector].push(order);
      return acc;
    },
    {},
  );

  const toggleSector = (sector: string) => {
    setExpandedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sector)) {
        next.delete(sector);
      } else {
        next.add(sector);
      }
      return next;
    });
  };

  const handleNewOrder = (waiterId: string, sector: string) => {
    router.push(
      `${PRIVATE_ROUTES.POS_ORDER}?waiterId=${waiterId}&sector=${sector}`,
    );
  };

  const handleOrderClick = (order: Order) => {
    const params = new URLSearchParams();
    if (order.waiterId) params.set('waiterId', order.waiterId);
    if (order.sector) params.set('sector', order.sector);
    params.set('orderId', order.id);
    router.push(`${PRIVATE_ROUTES.POS_ORDER}?${params.toString()}`);
  };

  // Obtener sectores activos (con ordenes) + todos los del enum para mostrar
  // Las zonas visibles, más cualquier zona oculta que todavía tenga pedidos (no se pierden de vista).
  const allSectors = Array.from(
    new Set<string>([...ZONAS_VISIBLES, ...Object.keys(ordersBySector)]),
  );

  // Agrupar ordenes dentro de cada sector por mesonero
  const getOrdersByWaiterInSector = (sectorOrders: Order[]) => {
    const byWaiter: Record<string, Order[]> = {};
    for (const order of sectorOrders) {
      const wId = order.waiterId || order.userId || 'sin_mesonero';
      if (!byWaiter[wId]) byWaiter[wId] = [];
      byWaiter[wId].push(order);
    }
    return byWaiter;
  };

  const totalPendingAmount = filteredZoneOrders.reduce(
    (sum, o) => sum + o.total,
    0,
  );

  // Obtener usuarios que tienen ordenes activas para mostrar en filtros (incluye cajeros)
  const waiterIdsWithOrders = new Set(
    zoneOrders.map((o) => o.waiterId || o.userId).filter(Boolean),
  );
  const usersSource = allUsers ?? waiters;
  const waitersWithOrders = usersSource.filter((u) =>
    waiterIdsWithOrders.has(u.id),
  );

  // Sectores que tienen ordenes activas
  const activeSectors = allSectors.filter(
    (sector) => (ordersBySector[sector] || []).length > 0,
  );

  // Estado para el dropdown de nueva orden
  const [showNewOrderDropdown, setShowNewOrderDropdown] = useState(false);
  const [selectedNewSector, setSelectedNewSector] = useState<string | null>(
    null,
  );

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-bold text-content flex items-center">
            <MapPin className="w-5 h-5 mr-1.5 text-brand" />
            Zonas
            {filteredZoneOrders.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-elevated text-content text-xs font-medium rounded-full">
                {filteredZoneOrders.length} • ${totalPendingAmount.toFixed(2)}
              </span>
            )}
          </h2>

          {/* Filtros por mesonero */}
          {waitersWithOrders.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-dim mr-0.5">Filtrar:</span>
              <button
                type="button"
                onClick={() => setSelectedWaiterId(null)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                  selectedWaiterId === null
                    ? 'bg-brand text-on-brand'
                    : 'bg-elevated text-dim hover:bg-elevated'
                }`}
              >
                Todos
              </button>
              {waitersWithOrders.map((waiter) => {
                const waiterOrderCount = zoneOrders.filter(
                  (o) => (o.waiterId || o.userId) === waiter.id,
                ).length;
                return (
                  <button
                    key={waiter.id}
                    type="button"
                    onClick={() =>
                      setSelectedWaiterId(
                        selectedWaiterId === waiter.id ? null : waiter.id,
                      )
                    }
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                      selectedWaiterId === waiter.id
                        ? 'bg-brand text-on-brand'
                        : 'bg-elevated text-dim hover:bg-elevated'
                    }`}
                  >
                    {waiter.name} ({waiterOrderCount})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Boton nueva orden de zona */}
        <div className="relative">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs border-line text-dim hover:bg-elevated"
            onClick={() => setShowNewOrderDropdown(!showNewOrderDropdown)}
          >
            <Plus className="w-3 h-3 mr-1" />
            Nueva Orden de Zona
          </Button>
          {showNewOrderDropdown && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-surface rounded-lg shadow-xl border border-line p-2 min-w-[200px]">
              {!selectedNewSector ? (
                <div>
                  <p className="text-xs font-medium text-dim px-2 py-1">
                    Selecciona sector:
                  </p>
                  {allSectors.map((sector) => (
                    <button
                      key={sector}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-elevated rounded flex items-center gap-2"
                      onClick={() => setSelectedNewSector(sector)}
                    >
                      <span>{SECTOR_ICONS[sector] || '📍'}</span>
                      <span>{SECTOR_LABELS[sector] || sector}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    className="text-xs text-brand hover:text-content mb-1 px-2"
                    onClick={() => setSelectedNewSector(null)}
                  >
                    ← Cambiar sector
                  </button>
                  <p className="text-xs font-medium text-dim px-2 py-1">
                    {SECTOR_ICONS[selectedNewSector]}{' '}
                    {SECTOR_LABELS[selectedNewSector]} — Mesonero:
                  </p>
                  {waiters.map((waiter) => (
                    <button
                      key={waiter.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-elevated rounded flex items-center gap-2"
                      onClick={() => {
                        handleNewOrder(waiter.id, selectedNewSector);
                        setShowNewOrderDropdown(false);
                        setSelectedNewSector(null);
                      }}
                    >
                      <UserCheck className="w-3.5 h-3.5 text-brand" />
                      <span>{waiter.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {activeSectors.length === 0 ? (
        <p className="text-sm text-dim text-center py-3">
          Sin ordenes activas en zonas
        </p>
      ) : (
        <div className="space-y-3">
          {activeSectors.map((sector) => {
            const sectorOrders = ordersBySector[sector] || [];
            const isExpanded = expandedSectors.has(sector);
            const ordersByWaiter = getOrdersByWaiterInSector(sectorOrders);
            const sectorTotal = sectorOrders.reduce(
              (sum, o) => sum + o.total,
              0,
            );

            return (
              <Card
                key={sector}
                className="bg-surface/90 backdrop-blur-sm shadow-lg border border-line/50 overflow-hidden"
              >
                {/* Header del sector */}
                <button
                  type="button"
                  onClick={() => toggleSector(sector)}
                  className="w-full p-3 flex items-center justify-between hover:bg-elevated/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {SECTOR_ICONS[sector] || '📍'}
                    </span>
                    <div className="text-left">
                      <h3 className="text-sm font-bold text-content">
                        {SECTOR_LABELS[sector] || sector}
                      </h3>
                      <p className="text-xs text-dim">
                        {sectorOrders.length}{' '}
                        {sectorOrders.length === 1 ? 'orden' : 'ordenes'} • $
                        {sectorTotal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{sectorOrders.length}</Badge>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-dim" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-dim" />
                    )}
                  </div>
                </button>

                {/* Contenido expandido */}
                {isExpanded && (
                  <div className="border-t border-line p-3">
                    <div className="space-y-3">
                      {Object.entries(ordersByWaiter).map(
                        ([wId, waiterOrders]) => {
                          const waiter = waiterMap.get(wId);
                          const waiterTotal = waiterOrders.reduce(
                            (sum, o) => sum + o.total,
                            0,
                          );

                          return (
                            <div key={wId}>
                              {/* Header del mesonero */}
                              <div className="flex items-center gap-2 mb-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-brand" />
                                <span className="text-xs font-semibold text-dim">
                                  {waiter?.name || 'Sin mesonero'}
                                </span>
                                <span className="text-[11px] text-dim">
                                  {waiterOrders.length} orden
                                  {waiterOrders.length !== 1 ? 'es' : ''} • $
                                  {waiterTotal.toFixed(2)}
                                </span>
                              </div>

                              {/* Cards de ordenes */}
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                                {waiterOrders.map((order) => (
                                  <Card
                                    key={order.id}
                                    className="cursor-pointer hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-brand/5 to-elevated border border-brand/20 hover:border-line"
                                    onClick={() => handleOrderClick(order)}
                                  >
                                    <div className="p-3">
                                      {/* Header: ID + Status */}
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[11px] font-mono text-dim">
                                          #{order.id.slice(-6).toUpperCase()}
                                        </span>
                                        <span
                                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${getOrderStatusColor(order.status)}`}
                                        >
                                          {getOrderStatusText(order.status)}
                                        </span>
                                      </div>

                                      {/* Alias */}
                                      <div className="text-xs">
                                        {order.customerAlias ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onEditAlias?.(order);
                                            }}
                                            className="flex items-center gap-1 font-semibold text-brand hover:text-brand transition-colors"
                                          >
                                            <Users className="w-3 h-3" />
                                            <span className="truncate max-w-[100px]">
                                              {order.customerAlias}
                                            </span>
                                            <Pencil className="w-2.5 h-2.5 opacity-60" />
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onEditAlias?.(order);
                                            }}
                                            className="flex items-center gap-1 text-dim hover:text-brand transition-colors"
                                          >
                                            <Users className="w-3 h-3" />
                                            <span className="italic">
                                              + alias
                                            </span>
                                          </button>
                                        )}
                                      </div>

                                      {/* Asociado */}
                                      {order.associateNumber && (
                                        <div className="flex items-center gap-1 text-[11px] text-dim">
                                          <Hash className="w-2.5 h-2.5" />
                                          <span>{order.associateNumber}</span>
                                        </div>
                                      )}

                                      {/* Hora de inicio */}
                                      <div className="flex items-center gap-1 mt-1 text-[10px] text-dim">
                                        <Clock className="w-3 h-3" />
                                        <span>
                                          {formatSmartTime(order.createdAt)}
                                        </span>
                                      </div>

                                      {/* Monto e items */}
                                      <div className="flex items-center justify-between mt-1">
                                        <span className="text-sm font-bold text-brand">
                                          ${order.total.toFixed(2)}
                                        </span>
                                        <span className="text-[11px] text-dim">
                                          {order.items.length} items
                                        </span>
                                      </div>

                                      {/* Pago rechazado */}
                                      {order.paymentRejected && (
                                        <div className="mt-1.5 px-2 py-1 bg-danger/10 border border-danger/20 rounded-md">
                                          <p className="text-[10px] font-bold text-danger leading-tight">
                                            🚫 Pago rechazado
                                          </p>
                                          {order.paymentRejectionReason && (
                                            <p className="text-[9px] text-danger leading-tight">
                                              {order.paymentRejectionReason}
                                            </p>
                                          )}
                                        </div>
                                      )}

                                      {/* Acciones */}
                                      {(onTransferOrder || onResetOrder) && (
                                        <div className="mt-1.5 flex gap-1">
                                          {onTransferOrder && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onTransferOrder(order);
                                              }}
                                              className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-elevated hover:bg-brand/10 border border-brand/20 text-brand text-[10px] font-medium transition-colors"
                                            >
                                              <ArrowRightLeft className="w-3 h-3" />
                                              Traspasar
                                            </button>
                                          )}
                                          {onResetOrder && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onResetOrder(order);
                                              }}
                                              title="Resetear orden (borrar con PIN admin)"
                                              className="px-2 py-1 rounded-lg bg-elevated hover:bg-danger/10 border border-danger/20 text-danger text-[10px] font-medium transition-colors"
                                            >
                                              <Eraser className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
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
