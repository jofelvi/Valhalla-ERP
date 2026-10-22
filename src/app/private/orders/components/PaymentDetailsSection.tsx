'use client';
import React from 'react';
import { Order } from '@/modelTypes/order';
import { Payment } from '@/modelTypes/payment';
import { PaymentStatusEnum } from '@/shared';
import { Badge } from '@/components/shared/badge/badge';
import { formatCurrency } from '@/shared/utils/currencyHelpers';
import {
  getPaymentStatusColor,
  getPaymentStatusLabel,
  getPaymentMethodLabel,
} from './OrderStatusHelpers';

interface PaymentDetailsSectionProps {
  order: Order;
  payments: Payment[];
  loadingPayments: boolean;
}

export const PaymentDetailsSection: React.FC<PaymentDetailsSectionProps> = ({
  order,
  payments,
  loadingPayments,
}) => {
  return (
    <div className="bg-elevated p-4 rounded-lg">
      <h4 className="font-medium text-content mb-2">Estado del Pago</h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-dim">Estado:</span>
          <Badge
            className={getPaymentStatusColor(
              order.paymentStatus || PaymentStatusEnum.PENDING,
            )}
          >
            {getPaymentStatusLabel(
              order.paymentStatus || PaymentStatusEnum.PENDING,
            )}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-dim">Método:</span>
          <span className="text-content font-medium">
            {getPaymentMethodLabel(order.paymentMethod)}
          </span>
        </div>
        <div className="flex justify-between font-medium">
          <span className="text-content">Total USD:</span>
          <span className="text-ok">{formatCurrency(order.total)}</span>
        </div>
      </div>

      {/* Desglose de pagos */}
      {loadingPayments ? (
        <div className="mt-3 pt-3 border-t border-line">
          <div className="flex items-center gap-2 text-xs text-dim">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-dim"></div>
            Cargando pagos...
          </div>
        </div>
      ) : payments.length > 0 ? (
        <div className="mt-3 pt-3 border-t border-line space-y-2">
          <p className="text-xs font-semibold text-dim uppercase tracking-wide">
            Detalle de pagos
          </p>
          {payments.map((payment, idx) => (
            <div
              key={idx}
              className="bg-surface rounded-lg border border-line p-2.5 space-y-1"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-content">
                  {getPaymentMethodLabel(payment.method)}
                </span>
                <span className="text-xs font-bold text-ok">
                  {formatCurrency(payment.amount)}
                </span>
              </div>
              {payment.bcvRate && (
                <div className="flex justify-between text-xs text-dim">
                  <span>Tasa BCV:</span>
                  <span className="font-medium text-dim">
                    Bs{' '}
                    {payment.bcvRate.toLocaleString('es-VE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    / USD
                  </span>
                </div>
              )}
              {payment.expectedAmountBS && (
                <div className="flex justify-between text-xs text-dim">
                  <span>Monto en Bs:</span>
                  <span className="font-bold text-brand">
                    Bs{' '}
                    {payment.expectedAmountBS.toLocaleString('es-VE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              {payment.transactionId && (
                <div className="flex justify-between text-xs text-dim">
                  <span>Referencia:</span>
                  <span className="font-mono font-medium text-dim text-right break-all">
                    {payment.transactionId}
                  </span>
                </div>
              )}
              {payment.notes && (
                <div className="text-xs text-dim italic">{payment.notes}</div>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
