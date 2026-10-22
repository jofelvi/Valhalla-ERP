'use client';

import { Order } from '@/modelTypes/order';
import { User } from '@/modelTypes/user';
import { Button } from '@/components/shared/button/Button';
import { Card } from '@/components/shared/card/card';
import { Plus, MapPin } from 'lucide-react';
import { useMemo } from 'react';

interface ZonesCompactPanelProps {
  zoneOrders: Order[];
  allUsers: User[];
  onCreateNewOrder: () => void;
  onViewOrder: (orderId: string) => void;
}

const ZONE_LABELS: Record<string, string> = {
  salon_principal: 'Salón',
  piscina: 'Piscina',
  tenis: 'Tenis',
  futbol: 'Fútbol',
  beisbol: 'Béisbol',
  canchas: 'Canchas',
};

export function ZonesCompactPanel({
  zoneOrders,
  allUsers,
  onCreateNewOrder,
  onViewOrder,
}: ZonesCompactPanelProps) {
  const ordersByZone = useMemo(() => {
    const grouped = new Map<string, Order[]>();
    zoneOrders.forEach((order) => {
      const zone = order.sector || 'salon_principal';
      if (!grouped.has(zone)) grouped.set(zone, []);
      grouped.get(zone)!.push(order);
    });
    return grouped;
  }, [zoneOrders]);

  const zones = Array.from(ordersByZone.entries()).sort(
    ([a], [b]) =>
      Object.keys(ZONE_LABELS).indexOf(a) - Object.keys(ZONE_LABELS).indexOf(b),
  );

  return (
    <div className="w-64 bg-elevated border-l border-line overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="sticky top-0 p-3 border-b border-line bg-surface">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-display font-bold text-content flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand" />
            Zonas
          </h3>
        </div>
      </div>

      {/* Zonas */}
      <div className="flex-1 space-y-2 p-3">
        {zones.length > 0 ? (
          zones.map(([zone, orders]) => (
            <div key={zone} className="space-y-1.5">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-semibold text-dim">
                  {ZONE_LABELS[zone] || zone}
                </span>
                <span className="inline-flex items-center justify-center w-5 h-5 bg-brand/20 text-brand text-xs font-bold rounded">
                  {orders.length}
                </span>
              </div>
              <div className="space-y-1">
                {orders.map((order) => (
                  <Card
                    key={order.id}
                    className="p-2 cursor-pointer hover:bg-page transition-colors bg-page border-accent/20 hover:border-accent/50"
                    onClick={() => onViewOrder(order.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-bold text-content truncate">
                          #{order.id.slice(-6).toUpperCase()}
                        </p>
                        <p className="text-[10px] text-dim truncate">
                          {order.items.length} items
                        </p>
                      </div>
                      <div className="flex flex-col items-end ml-1">
                        <span className="text-xs font-bold text-brand">
                          ${order.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {order.waiterId && (
                      <div className="mt-1 text-[10px] text-dim">
                        {(() => {
                          const w = allUsers.find(
                            (u) => u.id === order.waiterId,
                          );
                          return w?.name ?? 'sin asignar';
                        })()}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-dim">
            <MapPin className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs">Sin órdenes en zonas</p>
          </div>
        )}
      </div>

      {/* Footer: Nuevo para llevar */}
      <div className="border-t border-line p-3">
        <Button
          onClick={onCreateNewOrder}
          variant="default"
          size="sm"
          className="w-full bg-accent hover:bg-accent/90 text-on-brand text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Nuevo Para Llevar
        </Button>
      </div>
    </div>
  );
}
