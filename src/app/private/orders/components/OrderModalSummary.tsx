'use client';
import React from 'react';
import { Order } from '@/modelTypes/order';
import { Table } from '@/modelTypes/table';
import { Payment } from '@/modelTypes/payment';
import Modal from '@/components/shared/modal';
import { Badge } from '@/components/shared/badge/badge';
import { Button } from '@/components/shared/button/Button';
import { formatCurrency } from '@/shared/utils/currencyHelpers';
import { formatDate } from '@/shared/utils/dateHelpers';
import { getDisplayOrderNumber } from '@/shared/utils/orderNumber';
import { getStatusColor, getStatusLabel } from './OrderStatusHelpers';
import { PaymentDetailsSection } from './PaymentDetailsSection';

interface OrderModalSummaryProps {
  isOpen: boolean;
  order: Order | null;
  payments: Payment[];
  loadingPayments: boolean;
  tables: Table[];
  onClose: () => void;
}

export const OrderModalSummary: React.FC<OrderModalSummaryProps> = ({
  isOpen,
  order,
  payments,
  loadingPayments,
  tables,
  onClose,
}) => {
  if (!order) {
    return null;
  }

  const getTableName = (tableId: string): string => {
    const table = tables.find((t) => t.id === tableId);
    return table ? `Mesa ${table.number}` : tableId;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl">
      <div className="p-6">
        {/* Header del Modal */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-content">Resumen de Orden</h3>
            <p className="text-sm text-dim font-mono">
              {getDisplayOrderNumber(order)}
            </p>
          </div>
          <Badge className={getStatusColor(order.status)}>
            {getStatusLabel(order.status)}
          </Badge>
        </div>

        {/* Información de la Orden */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-elevated p-4 rounded-lg">
            <h4 className="font-medium text-content mb-2">
              Información General
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dim">Fecha:</span>
                <span className="text-content">
                  {formatDate(order.createdAt, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dim">Hora:</span>
                <span className="text-content">
                  {new Date(order.createdAt).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dim">Tipo:</span>
                <span className="text-content">
                  {order.tableId
                    ? getTableName(order.tableId)
                    : order.orderType === 'takeaway'
                      ? 'Para Llevar'
                      : 'Delivery'}
                </span>
              </div>
            </div>
          </div>

          <PaymentDetailsSection
            order={order}
            payments={payments}
            loadingPayments={loadingPayments}
          />
        </div>

        {/* Elementos de la Orden */}
        <div className="mb-6">
          <h4 className="font-medium text-content mb-3">
            Elementos del Pedido
          </h4>
          <div className="border border-line rounded-lg overflow-hidden">
            <div className="divide-y divide-line">
              {order.items.map((item, index) => (
                <div
                  key={index}
                  className="p-4 flex justify-between items-center"
                >
                  <div className="flex-1">
                    <h5 className="font-medium text-content">{item.name}</h5>
                    <p className="text-sm text-dim">
                      Cantidad: {item.quantity} x{' '}
                      {formatCurrency(item.unitPrice)}
                    </p>
                    {item.notes && (
                      <p className="text-sm text-dim mt-1">
                        Nota: {item.notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-content">
                      {formatCurrency(item.total)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="border-t border-line pt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium text-content">
              Total Final:
            </span>
            <span className="text-xl font-bold text-ok">
              {formatCurrency(order.total)}
            </span>
          </div>
        </div>

        {/* Botón de Cerrar */}
        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
};
