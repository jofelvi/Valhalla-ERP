'use client';

import { useMemo } from 'react';
import { Order } from '@/modelTypes/order';
import { Table } from '@/modelTypes/table';
import { User } from '@/modelTypes/user';
import { Button } from '@/components/shared/button/Button';
import { X, Plus, DollarSign, Shuffle, RotateCcw } from 'lucide-react';
import { Card } from '@/components/shared/card/card';

interface MesaSidePanelProps {
  isOpen: boolean;
  table: (Table & { currentOrder?: Order | null }) | null;
  order: Order | null;
  allUsers: User[];
  onClose: () => void;
  onAddItems: (tableId: string) => void;
  onCharge: (orderId: string) => void;
  onTransfer: (table: Table & { currentOrder?: Order | null }) => void;
  onReset?: (table: Table & { currentOrder?: Order | null }) => void;
}

export function MesaSidePanel({
  isOpen,
  table,
  order,
  allUsers,
  onClose,
  onAddItems,
  onCharge,
  onTransfer,
  onReset,
}: MesaSidePanelProps) {
  const waiter = useMemo(() => {
    if (!order?.waiterId) return null;
    return allUsers.find((u) => u.id === order.waiterId);
  }, [order, allUsers]);

  const customer = useMemo(() => {
    if (!order?.customerId) return null;
    return allUsers.find((u) => u.id === order.customerId);
  }, [order, allUsers]);

  const pendingCount = useMemo(() => {
    if (!order) return 0;
    return (
      order.items?.filter((item) => (item.deliveredQty ?? 0) < item.quantity)
        .length || 0
    );
  }, [order]);

  if (!isOpen || !table) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-overlay z-40"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-80 bg-surface border-l border-line shadow-lg z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line bg-elevated">
          <h2 className="text-lg font-display font-bold text-content">
            Mesa {table.number}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-dim hover:text-content"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {order ? (
            <>
              {/* Cuenta resumen */}
              <Card className="bg-page border-line">
                <div className="p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-dim font-medium">
                      ORDEN #{order.id.slice(-6).toUpperCase()}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        order.status === 'PAID'
                          ? 'bg-ok/20 text-ok'
                          : 'bg-brand/20 text-brand'
                      }`}
                    >
                      {order.status === 'PAID' ? 'Pagada' : 'Abierta'}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-xs text-dim block">Total</span>
                      <span className="text-2xl font-display font-bold text-brand">
                        ${order.total.toFixed(2)}
                      </span>
                    </div>
                    {pendingCount > 0 && (
                      <div className="text-right">
                        <span className="text-xs text-dim block">
                          Por servir
                        </span>
                        <span className="text-xl font-display font-bold text-warn">
                          {pendingCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Mesonero */}
              {waiter && (
                <div className="space-y-1">
                  <span className="text-xs text-dim font-medium">MESONERO</span>
                  <div className="flex items-center gap-2 p-2 bg-page rounded border border-line">
                    <div className="w-8 h-8 bg-brand/20 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-brand">
                        {waiter.name?.[0] ?? 'M'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-content block">
                        {waiter.name}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Cliente */}
              {customer && (
                <div className="space-y-1">
                  <span className="text-xs text-dim font-medium">CLIENTE</span>
                  <div className="flex items-center gap-2 p-2 bg-page rounded border border-line">
                    <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-accent">
                        {customer.name?.[0] ?? 'C'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-content block">
                        {customer.name}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Items preview */}
              <div className="space-y-1">
                <span className="text-xs text-dim font-medium">
                  {order.items?.length || 0} ÍTEMS
                </span>
                <div className="space-y-1">
                  {order.items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-content flex items-start justify-between gap-2 p-1.5 bg-page rounded"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="text-dim mr-1">×{item.quantity}</span>
                        {item.name || item.productName}
                      </span>
                      <span className="text-dim flex-shrink-0">
                        ${Number(item.total ?? item.totalPrice ?? 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-dim">
              <p className="text-sm">Mesa sin orden</p>
              <p className="text-xs mt-1">
                Toca &quot;Agregar&quot; para crear una
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-line p-4 space-y-2">
          {order ? (
            <>
              <Button
                onClick={() => onAddItems(table.id)}
                variant="default"
                className="w-full bg-brand hover:bg-brand-dark text-on-brand"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar productos
              </Button>
              <Button
                onClick={() => onCharge(order.id)}
                variant="default"
                className="w-full bg-ok hover:bg-ok/90 text-white"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Cobrar
              </Button>
              <div className="flex gap-2">
                <Button
                  onClick={() => onTransfer(table)}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Shuffle className="w-3.5 h-3.5 mr-1" />
                  Pasar
                </Button>
                {onReset && (
                  <Button
                    onClick={() => onReset(table)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Button
              onClick={() => onAddItems(table.id)}
              variant="default"
              className="w-full bg-brand hover:bg-brand-dark text-on-brand"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Orden
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
