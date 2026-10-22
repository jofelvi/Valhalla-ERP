'use client';

import { useMemo } from 'react';
import { Order } from '@odin6/types';
import { aFecha } from '@/shared/utils/dateHelpers';
import { SalesIntervalEnum } from '@/shared';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { getIntervalDateRange } from './intervalUtils';
import { useWaiters } from '@/hooks/useUsers';

interface WaiterRank {
  id: string;
  name: string;
  orders: number;
  revenue: number;
  avgTicket: number;
}

interface TopWaitersProps {
  orders: Order[];
  interval: SalesIntervalEnum;
}

export default function TopWaiters({ orders, interval }: TopWaitersProps) {
  const { data: users = [], isLoading: usersLoading } = useWaiters();

  const userNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.id, u.name);
    return map;
  }, [users]);

  const { start, end } = getIntervalDateRange(interval);

  const filteredOrders = orders.filter((o) => {
    if (o.paymentStatus !== 'paid' || !o.createdAt || !o.waiterId) return false;
    const date = aFecha(o.createdAt);
    return date >= start && date <= end;
  });

  // Agrupar por mesonero
  const waiterMap = new Map<string, WaiterRank>();

  for (const order of filteredOrders) {
    const wId = order.waiterId!;
    const existing = waiterMap.get(wId);
    const total = order.subtotal || 0;

    if (existing) {
      existing.orders += 1;
      existing.revenue += total;
      existing.avgTicket = existing.revenue / existing.orders;
    } else {
      waiterMap.set(wId, {
        id: wId,
        name: userNames.get(wId) || wId.slice(-6),
        orders: 1,
        revenue: total,
        avgTicket: total,
      });
    }
  }

  const ranked = Array.from(waiterMap.values()).map((w) => ({
    ...w,
    name: userNames.get(w.id) || w.name,
  }));

  ranked.sort((a, b) => b.revenue - a.revenue);

  if (usersLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex items-center gap-3">
            <div className="w-10 h-10 bg-elevated rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-elevated rounded w-2/3" />
              <div className="h-2 bg-elevated rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (ranked.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-brand text-sm">Sin datos en este período</p>
      </div>
    );
  }

  const maxRevenue = ranked[0].revenue;

  return (
    <div className="space-y-3">
      {ranked.map((waiter, index) => {
        const barWidth = (waiter.revenue / maxRevenue) * 100;
        const initials = waiter.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        return (
          <div key={waiter.id} className="group">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-on-brand shrink-0 ${
                  index === 0
                    ? 'bg-gradient-to-br from-amber-400 to-amber-600 ring-2 ring-amber-300'
                    : index === 1
                      ? 'bg-gradient-to-br from-gray-300 to-gray-500'
                      : index === 2
                        ? 'bg-gradient-to-br from-orange-400 to-orange-600'
                        : 'bg-gradient-to-br from-brand-light to-brand'
                }`}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-sm font-semibold text-content truncate pr-2">
                    {waiter.name}
                  </p>
                  <span className="text-sm font-bold text-brand shrink-0">
                    {formatearUsdConMiles(waiter.revenue)}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-brand">
                    {waiter.orders} órdenes · Prom:{' '}
                    {formatearUsdConMiles(waiter.avgTicket)}
                  </span>
                </div>
                <div className="w-full bg-elevated rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-brand transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
