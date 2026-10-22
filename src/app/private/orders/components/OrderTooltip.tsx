'use client';
import React from 'react';
import { FiMapPin, FiUser } from 'react-icons/fi';
import { Order } from '@/modelTypes/order';
import { Table } from '@/modelTypes/table';
import { getDisplayOrderNumber } from '@/shared/utils/orderNumber';
import { formatCurrency } from '@/shared/utils/currencyHelpers';
import { getStatusColor, getStatusLabel } from './OrderStatusHelpers';

interface OrderTooltipProps {
  order: Order | null;
  position: { top: number; left: number };
  tables: Table[];
}

export const OrderTooltip: React.FC<OrderTooltipProps> = ({
  order,
  position,
  tables,
}) => {
  if (!order) {
    return null;
  }

  const getTableName = (tableId: string): string => {
    const table = tables.find((t) => t.id === tableId);
    return table ? `Mesa ${table.number}` : tableId;
  };

  return (
    <div
      className="fixed z-50 bg-surface/95 backdrop-blur-md border border-line/50 rounded-xl shadow-2xl w-72 pointer-events-none animate-in fade-in duration-150"
      style={{ top: position.top, left: position.left }}
    >
      {/* Header */}
      <div className="px-3.5 pt-3 pb-2.5 border-b border-line/50">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono font-bold text-content text-sm">
            {getDisplayOrderNumber(order)}
          </span>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStatusColor(order.status)}`}
          >
            {getStatusLabel(order.status)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-dim">
          {order.tableId && (
            <span className="flex items-center gap-1">
              <FiMapPin className="w-3 h-3 text-brand" />
              {getTableName(order.tableId)}
            </span>
          )}
          {order.customerAlias && (
            <span className="flex items-center gap-1">
              <FiUser className="w-3 h-3" />
              {order.customerAlias}
            </span>
          )}
          <span>
            {new Date(order.createdAt).toLocaleTimeString('es-VE', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="px-3.5 py-2.5">
        <p className="text-[10px] font-semibold text-dim uppercase tracking-wider mb-1.5">
          Productos ({order.items.length})
        </p>
        <div className="space-y-1 max-h-44 overflow-y-auto">
          {order.items.map((item, i) => (
            <div
              key={i}
              className="flex justify-between items-center gap-2 py-0.5"
            >
              <span className="text-xs text-content truncate flex-1">
                <span className="font-semibold text-brand">
                  {item.quantity}x
                </span>{' '}
                {item.name}
              </span>
              <span className="text-xs font-medium text-dim whitespace-nowrap">
                ${item.total.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3.5 py-2.5 bg-brand/5 rounded-b-xl border-t border-line/50 flex justify-between items-center">
        <span className="text-xs text-dim">
          {order.items.reduce((s, i) => s + i.quantity, 0)} items
        </span>
        <span className="text-sm font-bold text-brand">
          {formatCurrency(order.total)}
        </span>
      </div>
    </div>
  );
};
