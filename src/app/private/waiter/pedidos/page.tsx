'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWaiterOrders, type WaiterOrdersTab } from './hooks/useWaiterOrders';
import { useUserStore } from '@/shared/store/useUserStore';
import { Card } from '@/components/shared/card/card';
import Loader from '@/components/shared/Loader/Loader';
import { PRIVATE_ROUTES } from '@/shared';
import { ClipboardList, Clock, Users, Hash, MapPin } from 'lucide-react';
import { formatSmartTime } from '@/shared/utils/dateHelpers';
import { Panel } from '@/components/shared/panel/Panel';

type Filter = WaiterOrdersTab;

export default function WaiterOrdersPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const userId = user?.id;
  const [filter, setFilter] = useState<Filter>('active');

  // Solo se pide la pestaña a la vista (ver useWaiterOrders).
  const { data: filtered = [], isLoading } = useWaiterOrders(userId, filter);

  const total = filtered.reduce((s, o) => s + o.total, 0);

  if (isLoading) {
    return (
      <Loader fullScreen text="Cargando pedidos..." size="lg" color="primary" />
    );
  }

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      PENDING: 'Pendiente',
      IN_PROGRESS: 'En proceso',
      READY: 'Listo',
      DELIVERED: 'Entregado',
      PAID: 'Pagado',
      CANCELLED: 'Cancelado',
      CREDIT: 'Credito',
      CHECKING: 'Verificacion',
      COMPLETED: 'Completo',
    };
    return map[s] || s;
  };

  const statusColor = (s: string) => {
    if (s === 'PAID' || s === 'COMPLETED') return 'bg-ok/10 text-ok';
    if (s === 'CHECKING') return 'bg-accent/10 text-accent';
    if (s === 'CREDIT') return 'bg-elevated text-dim';
    if (s === 'READY') return 'bg-ok/10 text-ok';
    if (s === 'IN_PROGRESS') return 'bg-brand/10 text-brand';
    if (s === 'PENDING') return 'bg-accent/10 text-accent';
    return 'bg-elevated text-content';
  };

  return (
    <div className="p-3">
      <Panel className="p-3 mb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-brand/20 rounded-xl flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h1 className="text-base font-bold text-content">Mis Pedidos</h1>
            <p className="text-xs text-dim">
              {filtered.length} · ${total.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex gap-1.5">
          {(
            [
              ['active', 'Activos'],
              ['paid', 'Pagados'],
              ['all', 'Todos'],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === key
                  ? 'bg-brand text-on-brand'
                  : 'bg-elevated text-dim hover:text-content'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Panel>

      {filtered.length === 0 ? (
        <p className="text-sm text-dim text-center py-8">
          {filter === 'active'
            ? 'No tienes pedidos activos'
            : filter === 'paid'
              ? 'No hay pedidos pagados'
              : 'Sin pedidos todavia'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => (
            <Card
              key={order.id}
              onClick={() =>
                router.push(`${PRIVATE_ROUTES.POS_ORDER}?orderId=${order.id}`)
              }
              className="cursor-pointer bg-surface border border-line hover:border-brand/30 transition-all"
            >
              <div className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-mono text-dim">
                    #{order.id.slice(-6).toUpperCase()}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor(order.status)}`}
                  >
                    {statusLabel(order.status)}
                  </span>
                </div>

                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg font-bold text-brand">
                    ${order.total.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-dim">
                    {order.items.length} items
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-dim">
                  {order.tableName && (
                    <span className="flex items-center gap-1">
                      🍽️ {order.tableName}
                    </span>
                  )}
                  {order.sector && !order.tableName && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {order.sector}
                    </span>
                  )}
                  {order.customerAlias && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {order.customerAlias}
                    </span>
                  )}
                  {order.associateNumber && (
                    <span className="flex items-center gap-1">
                      <Hash className="w-2.5 h-2.5" />
                      {order.associateNumber}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 mt-1 text-[10px] text-dim">
                  <Clock className="w-3 h-3" />
                  <span>{formatSmartTime(order.createdAt)}</span>
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
    </div>
  );
}
