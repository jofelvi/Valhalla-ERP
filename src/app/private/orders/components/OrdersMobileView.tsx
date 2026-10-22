'use client';
import React from 'react';
import { FiMapPin, FiUser } from 'react-icons/fi';
import { Order } from '@/modelTypes/order';
import { Table } from '@/modelTypes/table';
import { PaymentStatusEnum } from '@/shared';
import { Badge } from '@/components/shared/badge/badge';
import { formatCurrency } from '@/shared/utils/currencyHelpers';
import {
  getStatusColor,
  getStatusLabel,
  getPaymentStatusColor,
  getPaymentStatusLabel,
  getPaymentMethodLabel,
} from './OrderStatusHelpers';

interface OrdersMobileViewProps {
  data: Order[];
  tables: Table[];
  receivableByOrderId: Map<string, { amount: number; paidAmount: number }>;
  waiters: Array<{ id: string; name: string }>;
  onOrderClick: (order: Order) => void;
}

export const OrdersMobileView: React.FC<OrdersMobileViewProps> = ({
  data,
  tables,
  receivableByOrderId,
  waiters,
  onOrderClick,
}) => {
  const getTableName = (tableId: string): string => {
    const table = tables.find((t) => t.id === tableId);
    return table ? `Mesa ${table.number}` : tableId;
  };

  const getWaiterName = (waiterId: string): string => {
    const waiter = waiters.find((w) => w.id === waiterId);
    return waiter?.name ?? waiterId.slice(0, 6);
  };

  return (
    <div className="lg:hidden space-y-3">
      {data.map((order) => {
        const ar = receivableByOrderId.get(order.id);
        const pendiente = ar ? ar.amount - ar.paidAmount : 0;
        const cobrado = ar ? order.total - pendiente : order.total;

        return (
          <div
            key={order.id}
            className="bg-surface rounded-xl shadow-sm border border-line p-4"
            onClick={() => onOrderClick(order)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-content">
                  #{order.id.slice(-6).toUpperCase()}
                </span>
                <Badge className={getStatusColor(order.status)}>
                  {getStatusLabel(order.status)}
                </Badge>
              </div>
              <span className="font-bold text-ok">
                {formatCurrency(Math.max(cobrado, 0))}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-dim mb-2">
              {order.tableId ? (
                <span className="flex items-center gap-1">
                  <FiMapPin className="w-3 h-3" />
                  {getTableName(order.tableId)}
                </span>
              ) : (
                <span>
                  {order.orderType === 'takeaway' ? 'Para Llevar' : 'Delivery'}
                </span>
              )}
              <span>
                {order.items.length}{' '}
                {order.items.length === 1 ? 'item' : 'items'}
              </span>
              <span>
                {new Date(order.createdAt).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  className={getPaymentStatusColor(
                    order.paymentStatus || PaymentStatusEnum.PENDING,
                  )}
                >
                  {getPaymentStatusLabel(
                    order.paymentStatus || PaymentStatusEnum.PENDING,
                  )}
                </Badge>
                <span className="text-xs text-dim">
                  {getPaymentMethodLabel(order.paymentMethod)}
                </span>
              </div>
              {order.waiterId && (
                <span className="text-xs text-brand flex items-center gap-1">
                  <FiUser className="w-3 h-3" />
                  {getWaiterName(order.waiterId)}
                </span>
              )}
            </div>

            {pendiente > 0.01 && (
              <div className="mt-2 text-xs text-accent bg-accent/10 rounded px-2 py-1">
                Credito pendiente: {formatCurrency(pendiente)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
